# Deployment Ownership

This document defines the official deployment architecture for DeepSolution. All team members must follow these guidelines to ensure consistency, security, and maintainability.

## Official Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) | Official UI, gradual migration from React |
| Hosting | Vercel | Preview + Production deployments |
| Database | Supabase | Source of truth, RLS multi-tenant |
| Backend | Express + tRPC | API layer (runs on Vercel serverless) |
| Automation | n8n | Workflow orchestration |
| AI | OpenAI API | Single AI provider |

## Vercel Configuration

### Project Structure

The Next.js application lives in `/nextjs-app` and deploys to Vercel. The existing React app continues to run during the migration period.

```
deepsolution/
├── nextjs-app/          ← Deploys to Vercel
│   ├── src/app/         ← App Router pages
│   ├── src/components/  ← Shared components
│   └── next.config.js   ← Vercel config
├── client/              ← Legacy React (migration in progress)
└── server/              ← tRPC backend
```

### Environment Variables

All environment variables are managed through Vercel's dashboard. Never commit `.env` files to the repository.

| Variable | Environment | Description |
|----------|-------------|-------------|
| `SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Production only | Service role key (server-side) |
| `SUPABASE_ANON_KEY` | All | Anonymous key (client-side) |
| `OPENAI_API_KEY` | Production only | OpenAI API access |
| `JWT_SECRET` | All | Session signing secret |
| `N8N_WEBHOOK_SECRET` | All | HMAC secret for n8n webhooks |

### Setting Environment Variables

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable with appropriate scope (Production, Preview, Development)
3. Redeploy after adding new variables

### Preview Deployments

Every pull request automatically creates a preview deployment. Preview URLs follow the pattern:

```
https://deepsolution-<branch>-<team>.vercel.app
```

Preview deployments use the same environment variables as production, except for sensitive keys which should use test/sandbox values.

## Domain Configuration

### Primary Domain

The production domain is configured in Vercel:

| Domain | Environment | Purpose |
|--------|-------------|---------|
| `app.deepsolution.com` | Production | Main application |
| `*.vercel.app` | Preview | PR previews |

### DNS Setup

1. Add domain in Vercel Dashboard → Project → Settings → Domains
2. Configure DNS records at your registrar:
   - `A` record pointing to Vercel's IP
   - `CNAME` for `www` subdomain
3. Enable automatic HTTPS (handled by Vercel)

### Subdomain Strategy

| Subdomain | Purpose |
|-----------|---------|
| `app.` | Main application |
| `api.` | API endpoints (if separated) |
| `docs.` | Documentation site |

## Deployment Process

### Production Deployment

Production deployments are triggered by merging to the `main` branch:

1. Create PR with changes
2. Review preview deployment
3. Merge to `main`
4. Vercel automatically deploys to production

### Manual Deployment

For emergency fixes:

```bash
cd nextjs-app
vercel --prod
```

### Rollback

To rollback to a previous deployment:

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

## Build Configuration

### vercel.json

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Build Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `pnpm build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |
| Node.js Version | 20.x |

## Security Considerations

### Environment Variable Security

1. **Never expose service keys to client**: Use `NEXT_PUBLIC_` prefix only for public variables
2. **Rotate keys regularly**: Update keys quarterly or after any security incident
3. **Use different keys per environment**: Production, Preview, and Development should have separate keys

### Access Control

| Role | Access Level |
|------|--------------|
| Admin | Full Vercel access, can deploy and configure |
| Developer | Can view deployments, cannot modify settings |
| Viewer | Read-only access to deployment logs |

### Audit Logging

Vercel provides deployment logs and audit trails. Review these regularly:

1. Vercel Dashboard → Activity
2. Check for unauthorized deployments
3. Monitor build times and failures

## Monitoring

### Health Checks

Configure health check endpoints:

```typescript
// /api/health
export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}
```

### Alerts

Set up alerts in Vercel for:

- Deployment failures
- High error rates
- Slow response times

## Migration Timeline

The migration from React to Next.js follows this timeline:

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Shell | ✅ Complete | Next.js App Router setup |
| 2. Auth + Layout | ✅ Complete | Authentication and navigation |
| 3. Dashboard | ✅ Complete | Home dashboard (read-only) |
| 4. Products | Pending | Product management |
| 5. Orders | Pending | Order management |
| 6. Full Migration | Pending | Complete React deprecation |

## Troubleshooting

### Build Failures

1. Check build logs in Vercel Dashboard
2. Verify all environment variables are set
3. Test build locally: `pnpm build`

### Environment Variable Issues

1. Ensure variable names match exactly (case-sensitive)
2. Redeploy after adding new variables
3. Check variable scope (Production vs Preview)

### Domain Issues

1. Verify DNS propagation: `dig app.deepsolution.com`
2. Check SSL certificate status in Vercel
3. Clear browser cache and retry

---

**IMPORTANT**: This document is the authoritative source for deployment configuration. Any changes to the deployment architecture must be documented here first.
