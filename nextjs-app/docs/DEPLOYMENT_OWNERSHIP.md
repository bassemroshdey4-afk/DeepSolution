# Deployment & Ownership Guide

**DeepSolution Private Alpha**

This document provides step-by-step instructions for deploying DeepSolution to production under your own accounts. All infrastructure must be owned by you, not by any third party.

---

## Ownership Requirements

Before deployment, ensure you have ownership of the following accounts and resources.

| Resource | Owner | Status Required |
|----------|-------|-----------------|
| Vercel Account | You | Team Owner/Admin |
| Supabase Project | You | Project Owner |
| GitHub Repository | You | Repository Owner |
| OpenAI Account | You | Billing Owner |
| Custom Domain (optional) | You | DNS Control |

---

## Step 1: Repository Setup

### Option A: Transfer from Manus Sandbox

Export the project files from Manus and push to your GitHub repository.

```bash
# Clone your empty repository
git clone https://github.com/YOUR_USERNAME/deepsolution.git
cd deepsolution

# Copy the nextjs-app contents
# (Download from Manus and extract)

git add .
git commit -m "Initial DeepSolution deployment"
git push origin main
```

### Option B: Direct Download

Download the project files from Manus Management UI and upload to your repository manually.

---

## Step 2: Supabase Setup

### 2.1 Create Project

Navigate to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project under your organization.

**Project Settings:**
- Name: `deepsolution` (or your preferred name)
- Region: Choose closest to your users
- Database Password: Generate a strong password and save it securely

### 2.2 Run Migrations

In Supabase SQL Editor, run the migration files in order.

**Migration Order:**
1. `supabase/migrations/00_preflight.sql`
2. `supabase/migrations/01_schema_core.sql`
3. `supabase/migrations/10_feature_flags.sql`

### 2.3 Configure Authentication

In Supabase Authentication settings, configure the following.

**Site URL:** `https://your-domain.vercel.app`

**Redirect URLs:**
```
https://your-domain.vercel.app/auth/callback
https://your-domain.vercel.app/api/auth/callback
```

### 2.4 Get API Keys

From Project Settings > API, copy the following values.

| Key | Environment Variable |
|-----|---------------------|
| Project URL | `SUPABASE_URL` |
| anon public | `SUPABASE_ANON_KEY` |
| service_role | `SUPABASE_SERVICE_KEY` |

---

## Step 3: Vercel Deployment

### 3.1 Connect Repository

Navigate to [Vercel Dashboard](https://vercel.com/dashboard) and click "Add New Project".

**Import Settings:**
- Repository: Select your GitHub repository
- Root Directory: `nextjs-app`
- Framework Preset: Next.js

### 3.2 Configure Environment Variables

Add the following environment variables in Vercel Project Settings.

**Required Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbG...` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbG...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY | `eyJhbG...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

**Access Control Variables (Private Alpha):**

| Variable | Description | Example |
|----------|-------------|---------|
| `ENABLE_BASIC_AUTH` | Enable HTTP Basic Auth | `true` |
| `BASIC_AUTH_USER` | Basic Auth username | `admin` |
| `BASIC_AUTH_PASS` | Basic Auth password | `your-secure-password` |

**Optional Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_WEBHOOK_URL` | n8n automation webhook | `https://n8n.your-domain.com/webhook/...` |
| `N8N_WEBHOOK_SECRET` | n8n webhook secret | `your-secret` |

### 3.3 Deploy

Click "Deploy" and wait for the build to complete. Vercel will provide you with deployment URLs.

**URLs Provided:**
- Production: `https://your-project.vercel.app`
- Preview: `https://your-project-git-branch.vercel.app`

---

## Step 4: Access Control Verification

### 4.1 Basic Auth Test

If `ENABLE_BASIC_AUTH=true`, visiting the site should prompt for credentials.

```bash
# Test with curl
curl -I https://your-domain.vercel.app
# Should return 401 Unauthorized

curl -I -u admin:your-password https://your-domain.vercel.app
# Should return 200 OK
```

### 4.2 Noindex Verification

Check that search engines cannot index the site.

```bash
# Check robots.txt
curl https://your-domain.vercel.app/robots.txt
# Should show "Disallow: /"

# Check headers
curl -I https://your-domain.vercel.app
# Should include "X-Robots-Tag: noindex, nofollow"
```

---

## Step 5: Super Admin Setup

### 5.1 Create Your User Account

Sign up through the application using your email.

### 5.2 Grant Super Admin Access

In Supabase SQL Editor, run the following query to grant yourself Super Admin access.

```sql
-- Replace with your actual user ID from auth.users
INSERT INTO super_admins (user_id, notes)
VALUES (
  'YOUR_USER_ID_FROM_AUTH_USERS',
  'Platform owner - initial setup'
);
```

To find your user ID, run the following query in Supabase.

```sql
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

### 5.3 Verify Super Admin Access

Navigate to `/env-check` in your browser. If you see the environment check page, Super Admin access is working.

---

## Security Checklist

Before going live, verify the following security measures are in place.

| Check | Status |
|-------|--------|
| Basic Auth enabled | ☐ |
| Strong Basic Auth password | ☐ |
| robots.txt blocking all crawlers | ☐ |
| X-Robots-Tag header present | ☐ |
| noindex meta tags in HTML | ☐ |
| Supabase RLS policies enabled | ☐ |
| Super Admin access verified | ☐ |
| Feature flags set to super_admin_only | ☐ |

---

## Troubleshooting

### Build Fails

Check the Vercel build logs for specific errors. Common issues include missing environment variables or TypeScript errors.

### Database Connection Fails

Verify that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correctly set in Vercel environment variables.

### Basic Auth Not Working

Ensure both `ENABLE_BASIC_AUTH=true` and `BASIC_AUTH_PASS` are set. The password cannot be empty.

---

## Support

For issues related to the DeepSolution platform, contact the development team. For Vercel or Supabase issues, refer to their respective documentation.

**Last Updated:** December 2024
