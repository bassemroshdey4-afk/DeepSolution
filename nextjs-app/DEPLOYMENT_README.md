# DeepSolution - Deployment Guide

## Production URL
**https://deepsolution.vercel.app**

---

## Vercel Project Settings

| Setting | Value |
|---------|-------|
| **Project Name** | deepsolution |
| **Team** | deepsolutions-projects |
| **Framework** | Next.js |
| **Root Directory** | `nextjs-app` |
| **Build Command** | `pnpm build` |
| **Install Command** | `pnpm install` |
| **Output Directory** | `.next` (auto-detected) |
| **Node.js Version** | 18.x or 20.x |

---

## Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for Deep Intelligence features | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | ✅ |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL for client-side | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for client-side | ✅ |
| `NEXTAUTH_SECRET` | Random secret for session encryption | ✅ |

### How to Get These Values

1. **OpenAI API Key**: https://platform.openai.com/api-keys
2. **Supabase Keys**: Supabase Dashboard → Project Settings → API

---

## Deployment Steps

### Option 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import from GitHub: `bassemroshdey4-afk/DeepSolution`
3. Set **Root Directory** to `nextjs-app`
4. Add all environment variables
5. Click Deploy

### Option 2: Vercel CLI

```bash
cd nextjs-app
vercel link --project=deepsolution
vercel env add OPENAI_API_KEY production
vercel env add SUPABASE_URL production
# ... add other env vars
vercel --prod
```

---

## Project Structure

```
DeepSolution/
├── nextjs-app/          ← Deploy this (Next.js App Router)
│   ├── src/
│   │   ├── app/         ← Pages and API routes
│   │   ├── components/  ← UI components
│   │   └── lib/         ← Utilities
│   ├── public/          ← Static assets
│   ├── package.json
│   └── vercel.json
├── client/              ← Legacy (DO NOT deploy)
└── server/              ← Legacy backend
```

---

## Features

- **Dashboard**: Overview of store performance
- **Orders Management**: Track and manage orders
- **Deep Intelligence™**: AI-powered product analysis
- **Arabic RTL Support**: Full right-to-left layout
- **Responsive Design**: Mobile-first approach

---

## Security Notes

- All secrets are stored in Vercel environment variables
- No secrets are committed to the repository
- Production uses HTTPS by default
- `robots.txt` blocks search engine indexing (private alpha)

---

## Support

For issues or questions, contact the project owner.
