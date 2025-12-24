# DeepSolution Deployment Ownership

## Project Information

| Property | Value |
|----------|-------|
| **Project Name** | DeepSolution |
| **Repository** | bassemroshdey4-afk/DeepSolution |
| **Framework** | Next.js 15.5.9 |
| **Node Version** | 22.x |
| **Package Manager** | pnpm |

## Deployment Configuration

### Vercel

| Property | Value |
|----------|-------|
| **Project URL** | https://deepsolution.vercel.app |
| **Team** | deepsolutions-projects |
| **Root Directory** | `nextjs-app` |
| **Build Command** | `NODE_ENV=production pnpm build` |
| **Output Directory** | `.next` |
| **Install Command** | `pnpm install` |

### Environment Variables (Required)

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Vercel Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Vercel Dashboard |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Vercel Dashboard |
| `NEXTAUTH_SECRET` | Session encryption secret | Vercel Dashboard |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Vercel Dashboard |
| `NEXT_PUBLIC_APP_ID` | Manus App ID | Vercel Dashboard |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_BASIC_AUTH` | Enable Basic Auth protection | `false` |
| `BASIC_AUTH_USER` | Basic Auth username | `admin` |
| `BASIC_AUTH_PASS` | Basic Auth password | (empty) |

## Supabase Configuration

### Auth Settings (Required)

**Site URL:**
```
https://deepsolution.vercel.app
```

**Redirect URLs:**
```
https://deepsolution.vercel.app/**
https://*.vercel.app/**
http://localhost:3000/**
http://localhost:3001/**
```

### Google OAuth (Optional)

**Authorized redirect URIs in Google Cloud Console:**
```
https://apqmzwprumnyoeqitrtx.supabase.co/auth/v1/callback
```

## Deployment Workflow

### Automatic Deployments

1. Push to `main` branch triggers automatic deployment
2. Preview deployments for pull requests
3. Production deployment after merge to main

### Manual Deployment

```bash
# Build locally
cd nextjs-app
pnpm install
NODE_ENV=production pnpm build

# Push to GitHub (triggers Vercel deployment)
git add .
git commit -m "feat: your changes"
git push origin main
```

## Troubleshooting

### Common Issues

1. **404 on routes**: Ensure all pages exist in `src/app/` directory
2. **OAuth redirect errors**: Check Supabase URL Configuration
3. **Build failures**: Check `pnpm-lock.yaml` is up to date
4. **PKCE errors**: Ensure using production URL for OAuth

### Health Checks

- **Build Status**: Check Vercel Dashboard → Deployments
- **Auth Status**: Visit `/login` and test Google OAuth
- **API Status**: Check browser console for errors

## Ownership

| Role | Contact |
|------|---------|
| **Project Owner** | Bassem Roshdey |
| **GitHub** | bassemroshdey4-afk |

## Last Updated

December 24, 2024
