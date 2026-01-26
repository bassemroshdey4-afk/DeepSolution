# Google OAuth Consent Screen Setup

## الهدف
جعل شاشة موافقة Google تظهر باسم **DeepSolution** ولوجو المنصة بدلاً من اسم Supabase.

---

## الخطوات

### 1. افتح Google Cloud Console
- اذهب إلى: https://console.cloud.google.com
- اختر المشروع المرتبط بـ OAuth

### 2. OAuth Consent Screen
- من القائمة الجانبية: **APIs & Services** → **OAuth consent screen**

### 3. ضبط البيانات

| الحقل | القيمة |
|-------|--------|
| **App name** | DeepSolution |
| **User support email** | بريدك الإلكتروني |
| **App logo** | ارفع لوجو المنصة (120x120 بكسل على الأقل) |
| **Application home page** | https://deepsolution.vercel.app |
| **Application privacy policy link** | https://deepsolution.vercel.app/privacy |
| **Application terms of service link** | https://deepsolution.vercel.app/terms |
| **Authorized domains** | deepsolution.vercel.app |

### 4. Scopes
- اضغط **Add or Remove Scopes**
- أضف:
  - `email`
  - `profile`
  - `openid`

### 5. Test Users (إذا كان في Testing mode)
- أضف بريدك الإلكتروني للاختبار

### 6. Publish App
- بعد الاختبار الناجح، اضغط **PUBLISH APP**
- هذا يسمح لأي مستخدم Google بتسجيل الدخول

---

## ملاحظات مهمة

1. **Authorized redirect URI في Google Credentials:**
   ```
   https://apqmzwprumnyoeqitrtx.supabase.co/auth/v1/callback
   ```
   (هذا هو Supabase callback، ليس موقعك)

2. **في Supabase Dashboard:**
   - Site URL: `https://deepsolution.vercel.app`
   - Redirect URLs: `https://deepsolution.vercel.app/auth/callback`

3. **Client ID و Secret:**
   - انسخهم من Google Cloud Console
   - الصقهم في Supabase → Authentication → Providers → Google

---

## التحقق
بعد الإعداد، جرب تسجيل الدخول وتأكد أن:
- ✅ يظهر اسم "DeepSolution" في شاشة الموافقة
- ✅ يظهر اللوجو الصحيح
- ✅ روابط Privacy و Terms تعمل
