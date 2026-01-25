# DeepSolution Environment Variables

## Required for Production (Vercel)

These environment variables **MUST** be set in Vercel → Settings → Environment Variables:

### Supabase Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://apqmzwprumnyoeqitrtx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Site Configuration

| Variable | Description | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_SITE_URL` | Production domain URL | `https://deepsolution.vercel.app` |

### n8n Integration (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_INSTANCE_URL` | n8n workspace URL | `https://deepsolution.app.n8n.cloud` |
| `N8N_API_KEY` | n8n API key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

---

## Where to Find These Values

### Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### n8n API Key

1. Go to your n8n workspace (e.g., `https://deepsolution.app.n8n.cloud`)
2. Go to **Settings → n8n API**
3. Create or copy your API key

---

## Setting Up in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the **deepsolution** project
3. Go to **Settings → Environment Variables**
4. Add each variable:
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: (paste your value)
   - Environment: Production, Preview, Development
5. Click **Save**
6. **Redeploy** the project for changes to take effect

---

## Local Development (.env.local)

Create a `.env.local` file in `nextjs-app/` directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://apqmzwprumnyoeqitrtx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL (use localhost for dev)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# n8n (optional)
N8N_INSTANCE_URL=https://deepsolution.app.n8n.cloud
N8N_API_KEY=your-n8n-api-key
```

**Note:** Never commit `.env.local` to git. It's already in `.gitignore`.

---

## Verification

After setting up environment variables, verify they're working:

1. Open your deployed site
2. Go to `/login`
3. Click "Login with Google"
4. If you see "redirect_uri not allowed" error → Check Supabase URL Configuration
5. If you see blank page → Check browser console for missing env vars

---

*Last updated: January 25, 2026*
