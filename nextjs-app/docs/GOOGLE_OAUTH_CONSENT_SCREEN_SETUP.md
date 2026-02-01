# دليل إعداد Google OAuth Consent Screen لـ DeepSolution

هذا الدليل يشرح كيفية إعداد شاشة موافقة Google OAuth ليظهر اسم **DeepSolution** وشعار المنصة بدلاً من دومين Supabase.

---

## المتطلبات

| العنصر | القيمة |
|--------|--------|
| **اسم التطبيق** | DeepSolution |
| **الشعار** | `logo-google-oauth.png` (مرفق في `/public/`) |
| **الصفحة الرئيسية** | https://deepsolution.vercel.app |
| **سياسة الخصوصية** | https://deepsolution.vercel.app/privacy |
| **شروط الاستخدام** | https://deepsolution.vercel.app/terms |

---

## الخطوات

### الخطوة 1: الدخول إلى Google Cloud Console

1. افتح [Google Cloud Console](https://console.cloud.google.com/)
2. تأكد من اختيار المشروع الصحيح (نفس المشروع المرتبط بـ Supabase)
3. من القائمة الجانبية، اختر **APIs & Services** → **OAuth consent screen**

---

### الخطوة 2: إعداد OAuth Consent Screen

#### User Type
- اختر **External** (لإتاحة التسجيل لأي حساب Google)
- اضغط **CREATE**

#### App Information

| الحقل | القيمة |
|-------|--------|
| **App name** | `DeepSolution` |
| **User support email** | بريدك الإلكتروني |
| **App logo** | ارفع ملف `logo-google-oauth.png` |

#### App Domain

| الحقل | القيمة |
|-------|--------|
| **Application home page** | `https://deepsolution.vercel.app` |
| **Application privacy policy link** | `https://deepsolution.vercel.app/privacy` |
| **Application terms of service link** | `https://deepsolution.vercel.app/terms` |

#### Authorized domains
أضف:
```
deepsolution.vercel.app
```

#### Developer contact information
أضف بريدك الإلكتروني

اضغط **SAVE AND CONTINUE**

---

### الخطوة 3: Scopes (النطاقات)

1. اضغط **ADD OR REMOVE SCOPES**
2. اختر النطاقات التالية:
   - `email` - عرض عنوان البريد الإلكتروني
   - `profile` - عرض المعلومات الشخصية الأساسية
   - `openid` - المصادقة باستخدام Google
3. اضغط **UPDATE**
4. اضغط **SAVE AND CONTINUE**

---

### الخطوة 4: Test Users (اختياري)

- إذا كان التطبيق في وضع **Testing**، أضف حسابات Gmail للاختبار
- يمكنك تخطي هذه الخطوة إذا كنت ستنشر التطبيق مباشرة

اضغط **SAVE AND CONTINUE**

---

### الخطوة 5: نشر التطبيق (Production)

1. ارجع إلى صفحة **OAuth consent screen**
2. في قسم **Publishing status**، اضغط **PUBLISH APP**
3. اضغط **CONFIRM**

> **ملاحظة:** بعد النشر، يمكن لأي حساب Google تسجيل الدخول. قبل النشر، فقط حسابات الاختبار المضافة يمكنها تسجيل الدخول.

---

### الخطوة 6: التحقق من Credentials

1. من القائمة الجانبية، اختر **APIs & Services** → **Credentials**
2. تأكد من وجود **OAuth 2.0 Client ID**
3. اضغط على الـ Client ID للتحقق من:
   - **Authorized redirect URIs** تشمل:
     ```
     https://<your-supabase-project>.supabase.co/auth/v1/callback
     ```

---

## التحقق من الإعدادات في Supabase

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك → **Authentication** → **Providers**
3. اضغط على **Google**
4. تأكد من:
   - **Client ID** و **Client Secret** من نفس مشروع Google Cloud
   - **Enabled** مفعّل

---

## النتيجة المتوقعة

بعد إتمام هذه الخطوات، عند الضغط على "تسجيل الدخول بـ Google" في DeepSolution:

1. ستظهر شاشة موافقة Google باسم **DeepSolution**
2. سيظهر الشعار الذي رفعته
3. ستظهر روابط Privacy Policy و Terms of Service

---

## استكشاف الأخطاء

### المشكلة: لا يظهر اسم التطبيق الجديد
- **الحل:** امسح cache المتصفح أو جرب في Incognito
- قد يستغرق تحديث الاسم بضع دقائق

### المشكلة: خطأ "App not verified"
- **الحل:** تأكد من نشر التطبيق (PUBLISH APP) أو أضف حسابك كـ Test User

### المشكلة: خطأ "redirect_uri_mismatch"
- **الحل:** تأكد من إضافة Supabase callback URL في Authorized redirect URIs

---

## ملفات مرفقة

| الملف | الموقع | الاستخدام |
|-------|--------|-----------|
| `logo-google-oauth.png` | `/public/` | شعار التطبيق في Google Consent Screen |

---

*آخر تحديث: فبراير 2026*
