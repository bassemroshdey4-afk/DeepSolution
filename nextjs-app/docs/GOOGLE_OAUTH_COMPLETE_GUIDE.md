# دليل إعداد Google OAuth الكامل لـ DeepSolution

هذا الدليل يشرح كيفية إعداد Google OAuth بشكل صحيح لمنصة DeepSolution بحيث تظهر شاشة موافقة Google باسم **DeepSolution** وليس اسم Supabase.

---

## الجزء الأول: إعداد Google Cloud Console

### الخطوة 1: الوصول إلى OAuth Consent Screen

1. افتح [Google Cloud Console](https://console.cloud.google.com/)
2. اختر مشروعك أو أنشئ مشروعاً جديداً
3. من القائمة الجانبية: **APIs & Services** → **OAuth consent screen**

### الخطوة 2: تكوين شاشة الموافقة (Consent Screen)

| الحقل | القيمة المطلوبة |
|-------|----------------|
| **App name** | DeepSolution |
| **User support email** | بريدك الإلكتروني (مثل: support@deepsolution.app) |
| **App logo** | ارفع لوجو DeepSolution (حجم 120x120 بكسل على الأقل) |
| **Application home page** | https://deepsolution.vercel.app |
| **Application privacy policy link** | https://deepsolution.vercel.app/privacy |
| **Application terms of service link** | https://deepsolution.vercel.app/terms |
| **Authorized domains** | deepsolution.vercel.app |
| **Developer contact email** | بريدك الإلكتروني |

### الخطوة 3: إضافة Scopes

اضغط **Add or Remove Scopes** وأضف:

| Scope | الوصف |
|-------|-------|
| `.../auth/userinfo.email` | عرض البريد الإلكتروني |
| `.../auth/userinfo.profile` | عرض معلومات الملف الشخصي |
| `openid` | المصادقة الأساسية |

### الخطوة 4: إنشاء OAuth Client ID

1. من القائمة: **APIs & Services** → **Credentials**
2. اضغط **+ CREATE CREDENTIALS** → **OAuth client ID**
3. اختر **Web application**
4. أدخل الإعدادات التالية:

| الحقل | القيمة |
|-------|--------|
| **Name** | DeepSolution Web Client |
| **Authorized JavaScript origins** | https://deepsolution.vercel.app |
| **Authorized redirect URIs** | https://[YOUR-PROJECT-ID].supabase.co/auth/v1/callback |

> **مهم جداً:** الـ redirect URI يجب أن يكون رابط Supabase وليس رابط تطبيقك!
> استبدل `[YOUR-PROJECT-ID]` بـ Project ID الخاص بك من Supabase Dashboard.

5. اضغط **Create** واحفظ:
   - **Client ID**
   - **Client Secret**

---

## الجزء الثاني: إعداد Supabase Dashboard

### الخطوة 1: تكوين URL Configuration

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى: **Authentication** → **URL Configuration**

| الإعداد | القيمة |
|---------|--------|
| **Site URL** | https://deepsolution.vercel.app |
| **Redirect URLs** | https://deepsolution.vercel.app/auth/callback |

> **ملاحظة:** يمكنك إضافة أكثر من redirect URL (واحد لكل سطر):
> ```
> https://deepsolution.vercel.app/auth/callback
> https://deepsolution.vercel.app/**
> http://localhost:3000/auth/callback
> ```

### الخطوة 2: تفعيل Google Provider

1. اذهب إلى: **Authentication** → **Providers**
2. ابحث عن **Google** واضغط عليه
3. فعّل **Enable Sign in with Google**
4. أدخل:

| الحقل | القيمة |
|-------|--------|
| **Client ID** | الـ Client ID من Google Cloud Console |
| **Client Secret** | الـ Client Secret من Google Cloud Console |

5. اضغط **Save**

---

## الجزء الثالث: إعداد Vercel Environment Variables

في Vercel Dashboard → Settings → Environment Variables، أضف:

| المتغير | القيمة | مثال |
|---------|--------|------|
| `NEXT_PUBLIC_SITE_URL` | رابط موقعك على Vercel | https://deepsolution.vercel.app |
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase | https://xxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام من Supabase | eyJhbGciOiJIUzI1NiIs... |

> **مهم:** بعد إضافة المتغيرات، اعمل **Redeploy** للتطبيق.

---

## الجزء الرابع: التحقق من الإعدادات

### قائمة التحقق النهائية

| الخطوة | الحالة |
|--------|--------|
| Google Cloud: App name = DeepSolution | ☐ |
| Google Cloud: Logo مرفوع | ☐ |
| Google Cloud: Privacy Policy URL صحيح | ☐ |
| Google Cloud: Terms URL صحيح | ☐ |
| Google Cloud: Authorized domain = deepsolution.vercel.app | ☐ |
| Google Cloud: Redirect URI = Supabase callback | ☐ |
| Supabase: Site URL = https://deepsolution.vercel.app | ☐ |
| Supabase: Redirect URL يشمل /auth/callback | ☐ |
| Supabase: Google Provider مفعّل | ☐ |
| Supabase: Client ID/Secret صحيحين | ☐ |
| Vercel: NEXT_PUBLIC_SITE_URL موجود | ☐ |
| Vercel: NEXT_PUBLIC_SUPABASE_URL موجود | ☐ |
| Vercel: NEXT_PUBLIC_SUPABASE_ANON_KEY موجود | ☐ |

---

## الجزء الخامس: اختبار OAuth Flow

### خطوات الاختبار

1. افتح نافذة Incognito جديدة
2. اذهب إلى: https://deepsolution.vercel.app/login
3. اضغط **تسجيل الدخول بـ Google**
4. يجب أن ترى شاشة موافقة Google باسم **DeepSolution**
5. اختر حساب Google
6. يجب أن يتم تحويلك إلى `/dashboard` أو `/onboarding`

### استكشاف الأخطاء

| الخطأ | السبب المحتمل | الحل |
|-------|--------------|------|
| `redirect_uri_mismatch` | Redirect URI في Google لا يطابق Supabase | تأكد أن Redirect URI = `https://[PROJECT].supabase.co/auth/v1/callback` |
| `no_code` | Supabase لم يرسل code | تأكد من Site URL و Redirect URLs في Supabase |
| `auth_failed` | فشل تبادل الكود | تأكد من Client ID/Secret صحيحين |
| صفحة بيضاء | خطأ في JavaScript | افتح Console وابحث عن الأخطاء |

---

## الجزء السادس: نشر التطبيق للإنتاج (Production)

### تحويل OAuth من Testing إلى Production

1. في Google Cloud Console → OAuth consent screen
2. اضغط **PUBLISH APP**
3. سيطلب منك Google مراجعة (قد تستغرق أيام)

> **ملاحظة:** في وضع Testing، فقط المستخدمين المضافين في Test Users يمكنهم تسجيل الدخول.
> لإضافة مستخدمين للاختبار: OAuth consent screen → Test users → Add users

---

## ملخص التدفق (Flow Summary)

```
المستخدم يضغط "تسجيل الدخول بـ Google"
        ↓
signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
        ↓
Supabase يحول إلى Google OAuth
        ↓
Google يعرض شاشة الموافقة (باسم DeepSolution)
        ↓
المستخدم يوافق
        ↓
Google يحول إلى Supabase: https://[PROJECT].supabase.co/auth/v1/callback
        ↓
Supabase يتحقق ويحول إلى: https://deepsolution.vercel.app/auth/callback?code=xxx
        ↓
route.ts يستدعي exchangeCodeForSession(code)
        ↓
Supabase ينشئ الجلسة ويضع cookies
        ↓
Redirect إلى /dashboard أو /onboarding
```

---

**آخر تحديث:** يناير 2026
