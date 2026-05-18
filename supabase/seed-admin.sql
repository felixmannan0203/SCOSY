-- Run this in Supabase SQL Editor to create the default Level 1 admin profile
-- Admin email: admin@plasu.edu.ng  |  Password: Admin@123456

INSERT INTO public.profiles (id, user_type, name, email, staff_id, admin_level, approval_status)
VALUES (
    'b3a60e99-9ff5-46dc-a29d-1b7a5f17b69b',
    'admin',
    'System Administrator',
    'admin@plasu.edu.ng',
    'admin',
    1,
    'approved'
)
ON CONFLICT (id) DO UPDATE SET
    user_type = 'admin',
    admin_level = 1,
    approval_status = 'approved';
