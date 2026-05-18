# SCOSY — Setup Guide

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project** → name it `scosy` → choose a region close to Nigeria (e.g. EU West)
3. Set a strong database password and save it

## Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

## Step 3: Get Your API Keys

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key

## Step 4: API Keys — Already Done ✅

Your Supabase credentials are already wired into `js/supabase-client.js`.

## Step 5: Create the Default Admin Account

1. In Supabase dashboard → **Authentication** → **Users** → **Invite user**
2. Enter: `admin@plasu.edu.ng` with password `Admin@123456` (change after first login)
3. After the user is created, copy the UUID from the Users table
4. Go to **SQL Editor** and run:

```sql
INSERT INTO public.profiles (id, user_type, name, email, staff_id, admin_level, approval_status)
VALUES (
  '<paste-uuid-here>',
  'admin',
  'System Administrator',
  'admin@plasu.edu.ng',
  'admin',
  1,
  'approved'
);
```

## Step 6: Enable Email Confirmations (Optional)

- For production: **Authentication** → **Settings** → configure SMTP
- For development: **Authentication** → **Settings** → disable "Confirm email"

## Step 7: Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From the project root: `vercel`
3. Follow the prompts — it will detect the static site automatically
4. Your app will be live at `https://scosy.vercel.app` (or similar)

## Step 8: Enable Realtime in Supabase

1. Go to **Database** → **Replication**
2. Enable replication for: `complaints`, `messages`, `notifications`

---

## How It Works Now

| Feature | How |
|---|---|
| Login / Register | Supabase Auth (JWT sessions) |
| Complaints | PostgreSQL `complaints` table |
| Messages | PostgreSQL `messages` table |
| Status sync | Supabase Realtime (WebSocket) |
| Notifications | DB triggers → `notifications` table → Realtime → Browser Notification API |
| Admin approval | Level 1 admin approves via dashboard |
| Deployment | Vercel static hosting |

## Folder Structure

```
pages/          HTML pages
css/            Stylesheets
js/
  supabase-client.js   All DB operations
  auth.js              Login/register
  student.js           Student dashboard
  admin.js             Admin dashboard
  scosy-ai.js          SCOSY AI module
supabase/
  schema.sql           Database schema
vercel.json            Deployment config
.env.example           Environment variables template
```
