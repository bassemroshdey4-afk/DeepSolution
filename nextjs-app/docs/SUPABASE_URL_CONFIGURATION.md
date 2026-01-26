# Supabase URL Configuration

## المشكلة الشائعة

إذا رأيت رسالة **"لم يتم استلام رمز المصادقة"** أو **"No code received"**، فالسبب غالبًا هو أن إعدادات URL في Supabase غير صحيحة.

---

## الإعدادات المطلوبة

### 1. افتح Supabase Dashboard

اذهب إلى: https://supabase.com/dashboard

### 2. اختر المشروع

اختر مشروع DeepSolution

### 3. افتح Authentication → URL Configuration

من القائمة الجانبية: **Authentication** → **URL Configuration**

### 4. اضبط الإعدادات التالية

#### Site URL
```
https://deepsolution.vercel.app
```

#### Redirect URLs (أضف كل هذه الروابط)
```
https://deepsolution.vercel.app/auth/callback
https://deepsolution.vercel.app/auth/callback/
https://deepsolution.vercel.app/login
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback/
```

---

## صورة توضيحية للإعدادات

```
┌─────────────────────────────────────────────────────────────┐
│ URL Configuration                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Site URL                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ https://deepsolution.vercel.app                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Redirect URLs                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ https://deepsolution.vercel.app/auth/callback           │ │
│ │ https://deepsolution.vercel.app/auth/callback/          │ │
│ │ https://deepsolution.vercel.app/login                   │ │
│ │ http://localhost:3000/auth/callback                     │ │
│ │ http://localhost:3000/auth/callback/                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                            [Save] [Cancel]  │
└─────────────────────────────────────────────────────────────┘
```

---

## التحقق من الإعدادات

بعد حفظ الإعدادات:

1. افتح https://deepsolution.vercel.app/login في **Incognito**
2. اضغط **تسجيل الدخول بـ Google**
3. بعد الموافقة، يجب أن يتم تحويلك إلى `/dashboard`

---

## استكشاف الأخطاء

| المشكلة | السبب | الحل |
|---------|-------|------|
| "لم يتم استلام رمز المصادقة" | Site URL أو Redirect URLs غير صحيحة | راجع الإعدادات أعلاه |
| يتم التحويل إلى صفحة خطأ | Redirect URL غير مضافة | أضف `/auth/callback` للـ Redirect URLs |
| يظل في صفحة Google | مشكلة في Google OAuth | راجع GOOGLE_OAUTH_CONSENT_SETUP.md |

---

## ملاحظات مهمة

1. **Site URL** يجب أن يكون بدون `/` في النهاية
2. **Redirect URLs** يجب أن تشمل النسختين (مع وبدون `/` في النهاية)
3. بعد تغيير الإعدادات، قد تحتاج لانتظار دقيقة قبل الاختبار
4. استخدم **Incognito** للاختبار لتجنب مشاكل الـ cache
