# DeepSolution - قائمة المهام

## المرحلة 1: البنية التحتية وقاعدة البيانات
- [x] تصميم schema قاعدة البيانات الكاملة مع نظام المستأجرين المتعدد
- [x] إنشاء جداول: tenants, users, products, orders, campaigns, ai_conversations, landing_pages
- [x] إضافة tenant_id لجميع الجداول مع فهارس مناسبة
- [x] إعداد علاقات الجداول (Foreign Keys)
- [x] دفع التغييرات لقاعدة البيانات (pnpm db:push)

## المرحلة 2: نظام المصادقة والمستأجرين
- [x] تطوير نظام تسجيل المستأجرين الجدد (Tenant Onboarding)
- [x] إنشاء صفحة التسجيل للمستأجرين الجدد
- [x] إعداد تدفق المصادقة مع ربط المستخدمين بالمستأجرين
- [x] إضافة middleware للتحقق من tenant_id في جميع الطلبات
- [x] إنشاء دوال مساعدة في db.ts لعزل البيانات
- [x] إصلاح مشكلة التحميل اللانهائي في ProtectedRoute
- [x] إصلاح دالة getUserTenants للعمل بدون foreign key joins
- [x] إصلاح دالة getUserByOpenId لاستخدام profile.id بشكل صحيح
- [x] إصلاح قيمة status في startTenantTrial (trial بدلاً من trialing)
- [x] إضافة التحقق من حالة onboarding في TenantOnboarding page

## المرحلة 3: الواجهة الأمامية الأساسية
- [x] إعداد دعم RTL للعربية في index.css
- [x] إضافة خطوط عربية من Google Fonts
- [x] إنشاء DashboardLayout عربي مع قائمة جانبية
- [x] بناء صفحة لوحة التحكم الرئيسية
- [x] إنشاء صفحة إدارة الطلبات
- [x] إنشاء صفحة إدارة المنتجات
- [x] إنشاء صفحة إدارة الحملات التسويقية
- [ ] إنشاء صفحة المخزون والشحن

## المرحلة 4: مولد صفحات الهبوط بالذكاء الاصطناعي
- [x] إنشاء tRPC procedures لتوليد صفحات الهبوط
- [x] تكامل OpenAI API لتحليل صور المنتجات
- [x] تطوير نظام توليد محتوى صفحات الهبوط
- [x] إنشاء واجهة رفع الصور ووصف المنتجات
- [x] إنشاء صفحة معاينة وتحرير صفحات الهبوط
- [x] حفظ صفحات الهبوط المولدة في قاعدة البيانات

## المرحلة 5: المساعد الذكي
- [x] تصميم نظام الذاكرة للمحادثات (ai_conversations table)
- [x] إنشاء tRPC procedures للمساعد الذكي
- [x] تكامل OpenAI API مع سياق المستأجر
- [x] بناء واجهة الدردشة مع المساعد الذكي
- [x] إضافة القدرة على فهم بيانات المستأجر (طلبات، منتجات، حملات)
- [x] تطوير نظام استرجاع السياق التاريخي

## المرحلة 6: نظام تتبع الحملات وحساب ROAS
- [x] إنشاء tRPC procedures لإدارة الحملات
- [x] إضافة حقول تتبع الإنفاق والإيرادات
- [x] تطوير خوارزمية حساب ROAS
- [x] إنشاء واجهة إضافة وتحرير الحملات
- [x] بناء لوحة تحليلات الحملات مع مخططات
- [x] إضافة تقارير الأداء التسويقي

## المرحلة 7: إدارة الطلبات والعمليات
- [x] إنشاء tRPC procedures لإدارة الطلبات
- [x] إضافة حالات الطلبات (جديد، قيد المعالجة، مشحون، مكتمل)
- [x] تطوير نظام تتبع حالات مركز الاتصال
- [x] إنشاء واجهة عرض وتحديث الطلبات
- [ ] إضافة نظام البحث والفلترة للطلبات
- [ ] تطوير نظام الإشعارات للطلبات الجديدة

## المرحلة 8: إدارة المخزون والشحن
- [ ] إنشاء tRPC procedures لإدارة المخزون
- [ ] إضافة حقول تتبع الكميات والمواقع
- [ ] تطوير نظام تنبيهات نفاد المخزون
- [ ] إنشاء واجهة إدارة المخزون
- [ ] إضافة نظام تتبع الشحنات
- [ ] ربط الطلبات بحالات الشحن

## المرحلة 9: الاختبار والتوثيق
- [x] كتابة اختبارات Vitest لـ tenant management
- [x] اختبار إنشاء tenant جديد عبر onboarding
- [x] اختبار رفض النطاقات المكررة
- [x] اختبار حالة onboarding
- [ ] اختبار عزل البيانات بين المستأجرين
- [ ] اختبار تدفقات المستخدم الكاملة
- [ ] إنشاء توثيق شامل للمطورين
- [ ] إنشاء دليل المستخدم بالعربية
- [ ] إعداد بيانات تجريبية (seed data)

## المرحلة 10: التحسينات النهائية
- [ ] تحسين الأداء وسرعة التحميل
- [ ] إضافة رسائل التحميل والأخطاء
- [ ] تحسين تجربة المستخدم على الأجهزة المحمولة
- [ ] مراجعة الأمان وعزل البيانات
- [ ] إنشاء checkpoint نهائي
- [ ] إعداد المشروع للنشر


## Phase 2: Platform Core Enablement (Supabase Integration)

### Onboarding Flow
- [x] Create Supabase client configuration
- [x] Create onboarding page with tenant creation form
- [x] Add localization selection (country, currency, language, timezone)
- [x] Integrate with start_tenant_trial() function
- [x] Link user to tenant via tenant_users
- [x] Update profile default_tenant_id
- [x] Auto-redirect to dashboard after onboarding

### Events Ingestion API
- [x] Create tRPC procedure for event ingestion
- [x] Support all tracking fields (UTM, ad platform, etc.)
- [x] Validate tenant_id and event_name
- [x] Return success/error response

### Arabic RTL Dashboard (Supabase-connected)
- [x] Connect dashboard to Supabase for real data
- [x] Display tenant info from Supabase
- [x] Show trial status and limits
- [x] إضافة شريط حالة Trial في Dashboard
- [ ] Display real orders/campaigns/products counts

### AI Read-only Insights
- [ ] Wire AI context retrieval from Supabase
- [ ] Display tenant insights on dashboard
- [ ] Show recommendations based on data

### Supabase Integration Completed
- [x] Database schema (48 tables)
- [x] RLS policies (180 policies)
- [x] Trial enforcement trigger
- [x] Helper functions (7 functions)
- [x] Boss Commerce tenant seed
- [x] Events tracking columns (17 columns)
- [x] Performance indexes


## Phase Auth + Payments Prep

### Manus OAuth Integration
- [x] تكامل Manus OAuth (Google, Microsoft, Apple)
- [x] إصلاح مشاكل foreign key constraints
- [x] إنشاء profiles بـ UUID مستقل

### RBAC Auto-linking
- [x] تحديث OAuth callback لـ upsert في profiles
- [x] ربط المستخدم تلقائياً في tenant_users كـ Owner بعد onboarding

### Payment Schema
- [x] إنشاء جدول payment_methods
- [x] إنشاء جدول payment_transactions
- [x] إنشاء جدول payment_proofs (Vodafone Cash manual)
- [x] إنشاء جدول webhook_events

### Payment APIs Stubs
- [x] إنشاء CRUD APIs لـ payment_methods
- [x] إنشاء APIs لـ payment_transactions
- [x] إنشاء APIs لـ payment_proofs
- [x] إنشاء APIs لـ webhook_events

### Settings Page
- [x] إنشاء صفحة Settings في لوحة التاجر
- [x] واجهة إدارة طرق الدفع
- [x] تفعيل/تعطيل كل طريقة دفع


## Super Admin Module
- [x] إنشاء دور SuperAdmin على مستوى المنصة
- [x] إنشاء superAdminProcedure في tRPC
- [x] إنشاء superAdmin router مع APIs
- [x] API: عرض جميع المستأجرين
- [x] API: تفعيل/تعليق الحسابات
- [x] API: تغيير خطط الاشتراك
- [x] API: تعيين حدود استخدام AI
- [x] إنشاء صفحة /admin بسيطة
- [x] حفظ checkpoint


## Wallet System (نظام المحفظة) ✅
- [x] إنشاء جدول wallets (tenant_id, balance, currency)
- [x] إنشاء جدول wallet_transactions (شحن، خصم، استرداد)
- [ ] إنشاء جدول ai_addons (الإضافات المتاحة)
- [ ] إنشاء جدول tenant_addons (الإضافات المفعلة لكل tenant)
- [ ] إنشاء جدول usage_tracking (تتبع استخدام AI)
- [x] APIs: شحن المحفظة (wallet.topUp)
- [x] APIs: خصم من المحفظة (wallet.debit)
- [x] APIs: عرض الرصيد والمعاملات (wallet.getBalance, wallet.getTransactions)
- [ ] APIs: تفعيل/إلغاء الإضافات
- [ ] APIs: تتبع الاستخدام
- [x] واجهة المحفظة في Dashboard (/wallet)
- [x] الأسعار قابلة للتكوين (غير محددة)
- [x] منع الرصيد السالب (إلا بتجاوز Super Admin)
- [x] اختبارات Vitest (10 اختبارات)


## Order → Wallet Deduction Flow ✅
- [x] تعديل order.create لحساب التكلفة (رسوم المنصة قابلة للتكوين)
- [x] خصم المحفظة عند إنشاء الطلب
- [x] منع الطلب إذا الرصيد غير كافي
- [x] تجاوز Super Admin للرصيد السالب (عبر wallet.adminAdjust)
- [x] تسجيل المعاملة في wallet_transactions
- [x] اختبارات Vitest (13 اختبار)


## AI Add-ons Billing + Usage Tracking (MVP) ✅
- [x] إنشاء جدول ai_addons (الكتالوج)
- [x] إنشاء جدول tenant_ai_subscriptions (اشتراكات المستأجرين)
- [x] إنشاء جدول ai_usage_logs (سجل الاستخدام)
- [x] API: قائمة الإضافات المتاحة
- [x] API: تفعيل إضافة (خصم من المحفظة)
- [x] API: تجديد إضافة
- [x] API: تسجيل استخدام (مع التحقق من الحدود)
- [x] API: Super Admin - تفعيل بدون رسوم
- [x] API: Super Admin - تعديل الاستخدام المتبقي
- [x] منطق الفترة التجريبية (قابل للتكوين)
- [x] صفحة AI Add-ons في Dashboard
- [x] اختبارات Vitest (17 اختبار)


## Content Writer AI Feature (End-to-End) ✅
- [x] إنشاء API: aiAddons.generateContent
- [x] التحقق من تفعيل الإضافة
- [x] التحقق من usage_remaining
- [x] خصم الاستخدام
- [x] تسجيل الاستخدام في ai_usage_logs
- [x] استدعاء OpenAI API (عبر invokeLLM)
- [x] إرجاع المحتوى المولد
- [x] واجهة Content Writer بسيطة (/content-writer)
- [x] اختبار التدفق الكامل (10 اختبارات)


## AI Marketing Expert Pipeline (End-to-End)
### Phase 1: Product Intelligence Engine ✅
- [x] إنشاء ProductIntelligence type/interface
- [x] API: aiPipeline.analyzeProduct - تحليل صورة ووصف المنتج
- [x] استخراج: category, target_audience, USPs, pricing_range, tone, visual_style
- [x] تسجيل الاستخدام في ai_usage_logs
- [x] اختبار Vitest

### Phase 2: AI Landing Page Generator (Linked) ✅
- [x] API: aiPipeline.generateLandingPage يستخدم product_intelligence
- [x] توليد: headline, subheadline, heroSection, features, benefits, faq, CTA
- [x] تسجيل الاستخدام

### Phase 3: Meta Ads Generator ✅
- [x] API: aiPipeline.generateMetaAds
- [x] توليد: ad_angles, hooks, ad_copies, creative_briefs
- [x] اقتراح: objectives, audiences
- [x] حفظ في جدول campaigns

### Phase 4: Integration & Testing ✅
- [x] واجهة /ai-pipeline للتدفق الكامل
- [x] API: aiPipeline.runFullPipeline - تدفق كامل
- [x] اختبارات Vitest (7 اختبارات)
- [ ] checkpoint
