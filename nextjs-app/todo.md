
## OAuth Fix - Jan 25, 2026
- [x] Fix auth/callback/route.ts to properly read code and exchangeCodeForSession
- [x] Review /login page - no automatic redirects
- [x] Create Privacy Policy page (/privacy)
- [x] Create Terms of Service page (/terms)
- [x] Document Supabase URL Configuration steps
- [x] Document Google Cloud Console OAuth consent screen setup
- [x] Local build passes TypeScript
- [x] Push to GitHub and deploy to Vercel

## OAuth Root Cause Fix - Jan 26, 2026
- [x] Review current auth files (supabase client, callback, login, middleware)
- [x] Create callback/page.tsx as Client Component for Hash Flow support
- [x] Removed route.ts (conflict with page.tsx), merged both flows into page.tsx
- [x] Review and update Middleware to exclude /auth/callback
- [x] Review login page and ensure correct redirectTo
- [x] Build and local test - PASSED
- [ ] Push to GitHub and deploy
