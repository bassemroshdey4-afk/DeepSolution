# Supabase Auth Setup Guide

دليل إعداد نظام المصادقة باستخدام Supabase Auth لمنصة DeepSolution.

---

## نظرة عامة

تستخدم منصة DeepSolution نظام **Supabase Auth** للمصادقة، مع دعم:
- تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
- تسجيل الدخول عبر Google OAuth
- إدارة الجلسات باستخدام PKCE Flow

---

## المتطلبات الأساسية

| المتطلب | الوصف |
|---------|-------|
| حساب Supabase | [supabase.com](https://supabase.com) |
| مشروع Supabase | إنشاء مشروع جديد |
| Google Cloud Console | لإعداد OAuth (اختياري) |

---

## الخطوة 1: إعداد مشروع Supabase

### 1.1 إنشاء المشروع

1. انتقل إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. اضغط على **New Project**
3. أدخل اسم المشروع: `deepsolution`
4. اختر كلمة مرور قوية لقاعدة البيانات
5. اختر المنطقة الأقرب لمستخدميك

### 1.2 الحصول على المفاتيح

بعد إنشاء المشروع، انتقل إلى **Settings → API** للحصول على:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **تحذير:** لا تشارك `SUPABASE_SERVICE_KEY` أبداً في الكود العام أو الـ frontend.

---

## الخطوة 2: إعداد Authentication

### 2.1 تكوين Site URL

انتقل إلى **Authentication → URL Configuration**:

| الإعداد | القيمة |
|---------|--------|
| Site URL | `https://deepsolution.vercel.app` |

### 2.2 تكوين Redirect URLs

أضف الـ URLs التالية في **Redirect URLs**:

```
https://deepsolution.vercel.app/**
https://*.vercel.app/**
http://localhost:3000/**
```

> **ملاحظة:** استخدم `**` للسماح بجميع المسارات الفرعية.

---

## الخطوة 3: إعداد Google OAuth

### 3.1 إنشاء OAuth Credentials في Google Cloud

1. انتقل إلى [Google Cloud Console](https://console.cloud.google.com)
2. اختر أو أنشئ مشروعاً جديداً
3. انتقل إلى **APIs & Services → Credentials**
4. اضغط **Create Credentials → OAuth client ID**
5. اختر **Web application**

### 3.2 تكوين OAuth Client

| الإعداد | القيمة |
|---------|--------|
| Name | `DeepSolution Auth` |
| Authorized JavaScript origins | `https://deepsolution.vercel.app` |
| Authorized redirect URIs | `https://[PROJECT_REF].supabase.co/auth/v1/callback` |

> **هام:** استبدل `[PROJECT_REF]` بـ Reference ID لمشروع Supabase الخاص بك.

### 3.3 إضافة Credentials إلى Supabase

1. انتقل إلى **Authentication → Providers → Google**
2. فعّل Google Provider
3. أدخل:
   - **Client ID**: من Google Cloud Console
   - **Client Secret**: من Google Cloud Console
4. اضغط **Save**

---

## الخطوة 4: تكوين التطبيق

### 4.1 متغيرات البيئة

أضف المتغيرات التالية في Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 4.2 ملف supabase.ts (Browser Client)

```typescript
// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 4.3 ملف supabase-server.ts (Server Client)

```typescript
// src/lib/supabase-server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  )
}
```

---

## الخطوة 5: Auth Callback Route

### 5.1 إنشاء Callback Handler

```typescript
// src/app/auth/callback/route.ts
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

---

## الخطوة 6: صفحة تسجيل الدخول

### 6.1 Login Page Component

```typescript
// src/app/login/page.tsx
'use client'

import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleEmailLogin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error) {
      window.location.href = '/dashboard'
    }
  }

  return (
    // ... UI Component
  )
}
```

---

## الخطوة 7: Middleware للحماية

### 7.1 إعداد Middleware

```typescript
// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## استكشاف الأخطاء

### مشكلة: PKCE Code Verifier Missing

**السبب:** الـ cookies لا تُحفظ بشكل صحيح.

**الحل:**
1. تأكد من استخدام `@supabase/ssr` بدلاً من `@supabase/auth-helpers-nextjs`
2. تأكد من أن Redirect URL يستخدم نفس الـ domain

### مشكلة: OAuth Callback Error

**السبب:** Redirect URI غير مطابق.

**الحل:**
1. تأكد من إضافة جميع الـ URLs في Supabase Dashboard
2. تأكد من إضافة الـ callback URL في Google Cloud Console

### مشكلة: Session Not Persisting

**السبب:** الـ middleware لا يعمل بشكل صحيح.

**الحل:**
1. تأكد من أن الـ middleware يستخدم `createServerClient`
2. تأكد من أن الـ cookies تُقرأ وتُكتب بشكل صحيح

---

## الموارد

| المورد | الرابط |
|--------|--------|
| Supabase Auth Docs | [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth) |
| Supabase SSR Package | [github.com/supabase/ssr](https://github.com/supabase/ssr) |
| Google OAuth Setup | [developers.google.com/identity](https://developers.google.com/identity) |

---

## الإعدادات الحالية للمشروع

| الإعداد | القيمة |
|---------|--------|
| Supabase Project | `deepsolution` |
| Site URL | `https://deepsolution.vercel.app` |
| OAuth Providers | Google ✅ |
| Auth Package | `@supabase/ssr` |
| PKCE Flow | Enabled ✅ |

---

*آخر تحديث: ديسمبر 2024*
