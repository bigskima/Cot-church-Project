# Super Admin Setup & Public Organization UUID Guide

This document explains how your user account becomes the **Platform Super Admin** and where to get your **Public Organization UUID (`EXPO_PUBLIC_ORGANIZATION_ID`)**.

---

## 🔑 1. User UID vs. Organization UUID

* **User UID (`252518d9-23f5-4d69-8c37-5b1f090793ae`):**
  This is the unique identity of your personal account (`chivodotai@gmail.com`) inside Supabase Auth (`auth.users`).
* **Organization UUID (`EXPO_PUBLIC_ORGANIZATION_ID`):**
  This is the unique ID of your **Church entity** inside the `public.organizations` table. Because this platform is multi-tenant, the mobile app and guest web experience use this ID to know which church's sermons, livestreams, series, and feeds to load.

---

## ⚡ 2. Step-by-Step: Bootstrap Super Admin & Generate Organization UUID

### Step A: Open Supabase SQL Editor
1. Log into your **[Supabase Dashboard](https://supabase.com/dashboard/project/yqvkkgpffskszmmdwqxx)**.
2. In the left sidebar, click the **SQL Editor** icon (or open [this direct link](https://supabase.com/dashboard/project/yqvkkgpffskszmmdwqxx/sql/new)).
3. Click **"+ New Query"**.

### Step B: Paste & Run This SQL Script
Copy and paste the following SQL block and click **"Run"** (or press `Ctrl + Enter`):

```sql
-- 1. Create Super Admin Profile & Organization Setup
do $$
declare
  target_user_id uuid := '252518d9-23f5-4d69-8c37-5b1f090793ae'; -- chivodotai@gmail.com
  target_org_id uuid;
  target_branch_id uuid;
  target_membership_id uuid;
  owner_role_id uuid;
begin
  -- Ensure Profile exists
  insert into public.profiles (id, display_name)
  values (target_user_id, 'Platform Admin')
  on conflict (id) do update set display_name = coalesce(public.profiles.display_name, 'Platform Admin');

  -- Create or find primary Church Organization
  select id into target_org_id from public.organizations where slug = 'city-of-transformation' or slug = 'church-platform' limit 1;
  if target_org_id is null then
    insert into public.organizations (name, slug, timezone, created_by)
    values ('City of Transformation', 'city-of-transformation', 'UTC', target_user_id)
    returning id into target_org_id;
  end if;

  -- Create or find main Campus / Branch
  select id into target_branch_id from public.branches where organization_id = target_org_id and code = 'MAIN' limit 1;
  if target_branch_id is null then
    insert into public.branches (organization_id, name, code, timezone)
    values (target_org_id, 'Main Campus', 'MAIN', 'UTC')
    returning id into target_branch_id;
  end if;

  -- Create active Membership
  select id into target_membership_id from public.memberships where organization_id = target_org_id and profile_id = target_user_id limit 1;
  if target_membership_id is null then
    insert into public.memberships (organization_id, branch_id, profile_id, status, joined_at)
    values (target_org_id, target_branch_id, target_user_id, 'active', current_date)
    returning id into target_membership_id;
  else
    update public.memberships set status = 'active', branch_id = coalesce(branch_id, target_branch_id) where id = target_membership_id;
  end if;

  -- Create Owner Role with ALL permissions (including assigning & adding other admins)
  select id into owner_role_id from public.roles where organization_id = target_org_id and code = 'owner' limit 1;
  if owner_role_id is null then
    insert into public.roles (organization_id, code, name, description, is_system)
    values (target_org_id, 'owner', 'Organization Owner', 'Full super admin and organization access.', true)
    returning id into owner_role_id;
  end if;

  insert into public.role_permissions (role_id, permission_code)
  select owner_role_id, code from public.permissions where is_active
  on conflict do nothing;

  -- Assign Owner Role to your user
  insert into public.role_assignments (organization_id, membership_id, role_id, granted_by)
  values (target_org_id, target_membership_id, owner_role_id, target_user_id)
  on conflict do nothing;

  -- Ensure Church Story & Platform Branding exist
  insert into public.church_story (organization_id, title, subtitle, is_published)
  values (target_org_id, 'Our Story & Heritage', 'City of Transformation', true)
  on conflict do nothing;

  insert into public.platform_branding (platform_name, is_active)
  values ('City of Transformation', true)
  on conflict do nothing;
end;
$$;

-- 2. Query and display your Organization UUID:
select 
  o.id as "EXPO_PUBLIC_ORGANIZATION_ID",
  o.name as "organization_name",
  b.id as "main_branch_id",
  p.id as "admin_user_id",
  r.code as "assigned_role"
from public.organizations o
join public.branches b on b.organization_id = o.id
join public.memberships m on m.organization_id = o.id
join public.profiles p on p.id = m.profile_id
join public.role_assignments ra on ra.membership_id = m.id
join public.roles r on r.id = ra.role_id
where p.id = '252518d9-23f5-4d69-8c37-5b1f090793ae';
```

---

## 📋 3. How to See & Copy Your Organization UUID

When the query finishes executing, the results panel at the bottom will display a table:

```
┌──────────────────────────────────────┬─────────────────────────┬──────────────┐
│ EXPO_PUBLIC_ORGANIZATION_ID          │ organization_name       │ assigned_role│
├──────────────────────────────────────┼─────────────────────────┼──────────────┤
│ 7f3b8901-44ab-4c12-9876-abcdef012345 │ City of Transformation  │ owner        │
└──────────────────────────────────────┴─────────────────────────┴──────────────┘
```

The first value (`7f3b8901-...`) is your **`EXPO_PUBLIC_ORGANIZATION_ID`**.

> **Tip:** If you ever need to retrieve this UUID in the future, simply run:
> ```sql
> select id, name, slug from public.organizations;
> ```

---

## 🎯 4. Where to Set Your Organization UUID

### In Vercel:
In your **Mobile App Project on Vercel** → **Project Settings** → **Environment Variables**:
- **Key:** `EXPO_PUBLIC_ORGANIZATION_ID`
- **Value:** `<Paste the UUID you copied from the query above>`

### In Local Mobile `.env` (for local development):
In `apps/mobile/.env`:
```env
EXPO_PUBLIC_API_URL=https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1
EXPO_PUBLIC_ORGANIZATION_ID=<Paste the UUID you copied from the query above>
EXPO_PUBLIC_PAYMENT_PROVIDER=stripe
```

---

## 👥 5. How to Start Adding Other Admins

Now that your user `252518d9-23f5-4d69-8c37-5b1f090793ae` has the `owner` role:
1. Log into your **Admin Portal** using `chivodotai@gmail.com`.
2. Go to **Organization & Governance** / **Roles & Permissions**.
3. You can invite new staff members by email or assign roles (`admin`, `pastor`, `moderator`, `worship_leader`) to any congregation member.
4. Your account has full bypass and grant permissions across all modules.
