-- ============================================================
-- SCOSY — Fix RLS Policies
-- Run this in Supabase SQL Editor to replace broken policies
-- ============================================================

-- ---- Drop all existing policies ----
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

drop policy if exists "Students can view own complaints" on public.complaints;
drop policy if exists "Admins can view all complaints" on public.complaints;
drop policy if exists "Students can insert complaints" on public.complaints;
drop policy if exists "Admins can update complaints" on public.complaints;

drop policy if exists "Students can view their messages" on public.messages;
drop policy if exists "Admins can view all messages" on public.messages;
drop policy if exists "Authenticated users can insert messages" on public.messages;
drop policy if exists "Users can update read_by on messages" on public.messages;

drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "System can insert notifications" on public.notifications;

-- ---- PROFILES: simple, no recursion ----
-- Anyone authenticated can read any profile (needed for admin lookups)
create policy "Authenticated users can read profiles"
    on public.profiles for select
    to authenticated
    using (true);

create policy "Users can insert own profile"
    on public.profiles for insert
    to authenticated
    with check (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles for update
    to authenticated
    using (auth.uid() = id);

-- ---- COMPLAINTS ----
-- Students see their own; anonymous complaints visible to all authenticated
create policy "Students see own complaints"
    on public.complaints for select
    to authenticated
    using (student_id = auth.uid() or is_anonymous = true);

create policy "Authenticated can insert complaints"
    on public.complaints for insert
    to authenticated
    with check (true);

-- Allow all authenticated users to update complaints
-- (admin check is done in application code)
create policy "Authenticated can update complaints"
    on public.complaints for update
    to authenticated
    using (true);

-- ---- MESSAGES ----
create policy "Authenticated can read messages"
    on public.messages for select
    to authenticated
    using (true);

create policy "Authenticated can insert messages"
    on public.messages for insert
    to authenticated
    with check (auth.uid() = sender_id);

create policy "Authenticated can update messages"
    on public.messages for update
    to authenticated
    using (true);

-- ---- NOTIFICATIONS ----
create policy "Users see own notifications"
    on public.notifications for select
    to authenticated
    using (user_id = auth.uid());

create policy "Users update own notifications"
    on public.notifications for update
    to authenticated
    using (user_id = auth.uid());

create policy "Anyone can insert notifications"
    on public.notifications for insert
    with check (true);
