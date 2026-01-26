# Environment Variables Setup

## المتغيرات المطلوبة في Vercel

### 1. Supabase (مطلوب)

| Variable | الوصف | مصدر القيمة |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح Anon العام | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح Service Role (سري) | Supabase Dashboard → Settings → API |

### 2. Site URL (مطلوب)

| Variable | الوصف | القيمة |
|----------|-------|--------|
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع للـ OAuth | `https://deepsolution.vercel.app` |

---

## خطوات الإعداد في Vercel

1. افتح **Vercel Dashboard** → **Project** → **Settings** → **Environment Variables**

2. أضف المتغيرات التالية:

```
NEXT_PUBLIC_SUPABASE_URL = https://apqmzwprumnyoeqitrtx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [من Supabase Dashboard]
SUPABASE_SERVICE_ROLE_KEY = [من Supabase Dashboard]
NEXT_PUBLIC_SITE_URL = https://deepsolution.vercel.app
```

3. اضغط **Save**

4. اضغط **Redeploy** من آخر deployment

---

## التحقق من الإعدادات

بعد الـ Redeploy، افتح:
```
https://deepsolution.vercel.app/env-check
```

يجب أن ترى:
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ NEXT_PUBLIC_SITE_URL

---

## استكشاف الأخطاء

| الخطأ | السبب | الحل |
|-------|-------|------|
| `supabaseKey is required` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` ناقص | أضفه في Vercel |
| `لم يتم استلام رمز المصادقة` | Supabase URL Configuration خاطئ | راجع SUPABASE_URL_CONFIGURATION.md |
| `config_error` | متغيرات ENV ناقصة | راجع /env-check |
