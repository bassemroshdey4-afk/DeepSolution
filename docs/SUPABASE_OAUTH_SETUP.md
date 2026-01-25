# Supabase Google OAuth Setup Guide

## Overview

This guide explains how to configure Google OAuth for DeepSolution on Supabase.

---

## Step 1: Supabase URL Configuration

Go to **Supabase Dashboard → Authentication → URL Configuration**

### Site URL
```
https://deepsolution.vercel.app
```

### Redirect URLs (Add ALL of these)
```
https://deepsolution.vercel.app/auth/callback
https://deepsolution.vercel.app/**
https://*.vercel.app/auth/callback
https://*.vercel.app/**
```

**Screenshot reference:**
- Site URL field: Enter `https://deepsolution.vercel.app`
- Redirect URLs: Click "Add URL" for each URL above

---

## Step 2: Enable Google Provider in Supabase

Go to **Supabase Dashboard → Authentication → Providers → Google**

1. Toggle **Enable Google** to ON
2. Enter your Google OAuth credentials:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)
3. Click **Save**

---

## Step 3: Google Cloud Console Setup

Go to [Google Cloud Console](https://console.cloud.google.com/)

### 3.1 Create OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** user type
3. Fill in:
   - App name: `DeepSolution`
   - User support email: Your email
   - App logo: (optional, upload your logo)
   - App domain: `deepsolution.vercel.app`
   - Authorized domains: `deepsolution.vercel.app`, `supabase.co`
   - Developer contact email: Your email
4. Click **Save and Continue**
5. Scopes: Add `email` and `profile` scopes
6. Test users: Add your email for testing
7. Click **Save and Continue**

### 3.2 Create OAuth Client ID

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `DeepSolution Production`
5. Authorized JavaScript origins:
   ```
   https://deepsolution.vercel.app
   https://apqmzwprumnyoeqitrtx.supabase.co
   ```
6. Authorized redirect URIs:
   ```
   https://apqmzwprumnyoeqitrtx.supabase.co/auth/v1/callback
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

---

## Step 4: Verify Configuration

### Checklist

- [ ] Supabase Site URL = `https://deepsolution.vercel.app`
- [ ] Supabase Redirect URLs include `https://deepsolution.vercel.app/auth/callback`
- [ ] Google Provider enabled in Supabase
- [ ] Google OAuth Client ID and Secret added to Supabase
- [ ] Google Cloud authorized redirect URI = `https://apqmzwprumnyoeqitrtx.supabase.co/auth/v1/callback`
- [ ] Vercel env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`

---

## Common Errors and Solutions

### Error: "redirect_uri not allowed"

**Cause:** The redirect URL is not in Supabase's allowed list.

**Solution:**
1. Go to Supabase → Authentication → URL Configuration
2. Add `https://deepsolution.vercel.app/auth/callback` to Redirect URLs
3. Also add `https://deepsolution.vercel.app/**` for flexibility

### Error: "invalid_client"

**Cause:** Google OAuth credentials are incorrect.

**Solution:**
1. Verify Client ID and Client Secret in Supabase
2. Make sure they match Google Cloud Console
3. Check that the OAuth consent screen is configured

### Error: Blank page after login

**Cause:** Missing environment variables or callback route issue.

**Solution:**
1. Check Vercel env vars are set correctly
2. Verify `/auth/callback/route.ts` exists in the project
3. Check browser console for errors

### Error: "redirect_uri_mismatch" from Google

**Cause:** The redirect URI in Google Cloud doesn't match Supabase.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Add `https://apqmzwprumnyoeqitrtx.supabase.co/auth/v1/callback` to Authorized redirect URIs

---

## Testing Flow

1. Open `https://deepsolution.vercel.app/login`
2. Click "تسجيل الدخول بـ Google"
3. Select your Google account
4. You should be redirected to:
   - `/onboarding` (if new user)
   - `/dashboard` (if existing user)

---

## Architecture Diagram

```
User clicks "Login with Google"
         ↓
Login Page (signInWithOAuth)
         ↓
Supabase Auth Server
         ↓
Google OAuth (consent screen)
         ↓
Google redirects to: Supabase callback
(https://apqmzwprumnyoeqitrtx.supabase.co/auth/v1/callback)
         ↓
Supabase redirects to: App callback
(https://deepsolution.vercel.app/auth/callback)
         ↓
App exchanges code for session
         ↓
Redirect to /onboarding or /dashboard
```

---

*Last updated: January 25, 2026*
