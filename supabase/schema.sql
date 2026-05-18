-- ============================================================
-- SCOSY Database Schema for Supabase
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
    id          uuid references auth.users(id) on delete cascade primary key,
    user_type   text not null check (user_type in ('student', 'admin')),
    name        text not null,
    email       text not null unique,
    -- Student fields
    matric      text unique,
    level       text,
    -- Admin fields
    staff_id    text unique,
    position    text,
    admin_level integer default 2,
    approval_status text default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
    -- Shared
    last_login  timestamptz,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- ============================================================
-- COMPLAINTS TABLE
-- ============================================================
create table public.complaints (
    id              uuid default uuid_generate_v4() primary key,
    student_id      uuid references public.profiles(id) on delete set null,
    student_name    text,
    student_matric  text,
    category        text not null,
    priority        text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
    subject         text not null,
    message         text not null,
    status          text not null default 'pending' check (status in ('pending', 'in-progress', 'answered', 'resolved', 'closed')),
    is_anonymous    boolean default false,
    response_count  integer default 0,
    has_unread_response boolean default false,
    last_response_at timestamptz,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- ============================================================
-- MESSAGES TABLE (chat between admin and student)
-- ============================================================
create table public.messages (
    id              uuid default uuid_generate_v4() primary key,
    complaint_id    uuid references public.complaints(id) on delete cascade,
    sender_id       uuid references public.profiles(id) on delete set null,
    sender_name     text not null,
    sender_type     text not null check (sender_type in ('student', 'admin')),
    target_student_id uuid references public.profiles(id) on delete set null,
    message         text not null,
    is_broadcast    boolean default false,
    read_by         uuid[] default '{}',
    created_at      timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
create table public.notifications (
    id          uuid default uuid_generate_v4() primary key,
    user_id     uuid references public.profiles(id) on delete cascade,
    type        text not null,  -- 'complaint_response', 'new_complaint', 'status_change', 'broadcast'
    title       text not null,
    body        text not null,
    data        jsonb default '{}',
    is_read     boolean default false,
    created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users can read their own, admins can read all
create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Admins can view all profiles"
    on public.profiles for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and user_type = 'admin' and approval_status = 'approved'
        )
    );

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);

create policy "Users can insert own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- Complaints: students see own, admins see all
create policy "Students can view own complaints"
    on public.complaints for select
    using (student_id = auth.uid() or is_anonymous = true);

create policy "Admins can view all complaints"
    on public.complaints for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and user_type = 'admin' and approval_status = 'approved'
        )
    );

create policy "Students can insert complaints"
    on public.complaints for insert
    with check (auth.uid() = student_id or is_anonymous = true);

create policy "Admins can update complaints"
    on public.complaints for update
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and user_type = 'admin' and approval_status = 'approved'
        )
    );

-- Messages: students see messages for their complaints, admins see all
create policy "Students can view their messages"
    on public.messages for select
    using (
        target_student_id = auth.uid()
        or is_broadcast = true
        or sender_id = auth.uid()
        or exists (
            select 1 from public.complaints
            where id = messages.complaint_id and student_id = auth.uid()
        )
    );

create policy "Admins can view all messages"
    on public.messages for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and user_type = 'admin' and approval_status = 'approved'
        )
    );

create policy "Authenticated users can insert messages"
    on public.messages for insert
    with check (auth.uid() = sender_id);

create policy "Users can update read_by on messages"
    on public.messages for update
    using (true);

-- Notifications: users see own only
create policy "Users can view own notifications"
    on public.notifications for select
    using (user_id = auth.uid());

create policy "Users can update own notifications"
    on public.notifications for update
    using (user_id = auth.uid());

create policy "System can insert notifications"
    on public.notifications for insert
    with check (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger complaints_updated_at
    before update on public.complaints
    for each row execute function public.handle_updated_at();

create trigger profiles_updated_at
    before update on public.profiles
    for each row execute function public.handle_updated_at();

-- Function to create notification when admin responds
create or replace function public.notify_on_response()
returns trigger as $$
begin
    -- Notify the student when admin sends a message
    if new.sender_type = 'admin' and new.target_student_id is not null then
        insert into public.notifications (user_id, type, title, body, data)
        values (
            new.target_student_id,
            'complaint_response',
            'New Response to Your Complaint',
            new.sender_name || ' has responded to your complaint.',
            jsonb_build_object('complaint_id', new.complaint_id, 'message_id', new.id)
        );
    end if;

    -- Notify all approved admins when a student submits a complaint (via messages)
    if new.sender_type = 'student' then
        insert into public.notifications (user_id, type, title, body, data)
        select p.id,
               'new_message',
               'New Student Message',
               new.sender_name || ' sent a message.',
               jsonb_build_object('complaint_id', new.complaint_id, 'message_id', new.id)
        from public.profiles p
        where p.user_type = 'admin' and p.approval_status = 'approved';
    end if;

    return new;
end;
$$ language plpgsql security definer;

create trigger on_message_insert
    after insert on public.messages
    for each row execute function public.notify_on_response();

-- Function to notify admins of new complaints
create or replace function public.notify_on_complaint()
returns trigger as $$
begin
    insert into public.notifications (user_id, type, title, body, data)
    select p.id,
           'new_complaint',
           'New Complaint Submitted',
           coalesce(new.student_name, 'Anonymous') || ': ' || new.subject,
           jsonb_build_object('complaint_id', new.id, 'priority', new.priority)
    from public.profiles p
    where p.user_type = 'admin' and p.approval_status = 'approved';

    return new;
end;
$$ language plpgsql security definer;

create trigger on_complaint_insert
    after insert on public.complaints
    for each row execute function public.notify_on_complaint();

-- ============================================================
-- REALTIME: enable for live updates
-- ============================================================
alter publication supabase_realtime add table public.complaints;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- DEFAULT ADMIN ACCOUNT
-- NOTE: Create this user via Supabase Auth first, then run:
-- insert into public.profiles (id, user_type, name, email, staff_id, admin_level, approval_status)
-- values ('<auth-user-uuid>', 'admin', 'System Administrator', 'admin@plasu.edu.ng', 'admin', 1, 'approved');
-- ============================================================
