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
- [x] checkpoint (05fb7236)


## Golden Path - تثبيت خط الأنابيب ✅
### 1. حفظ البيانات (Data Persistence) ✅
- [x] إنشاء هيكل ai_pipeline_outputs (مع fallback للذاكرة)
- [x] حفظ intelligence, landing_page, meta_ads مع versioning
- [x] حفظ campaigns في جدول campaigns الموجود
- [x] APIs: getProductPipelineStatus, getOutputVersions, getOutputByVersion

### 2. إعادة التشغيل (Re-runnable Pipeline) ✅
- [x] forceRegenerate flag لتجاوز الذاكرة
- [x] كل مرحلة تحفظ كإصدار جديد (لا تحذف القديم)
- [x] fromCache flag لمعرفة مصدر البيانات
- [x] إعادة توليد كل مرحلة منفردة من UI

### 3. ربط AI Add-ons Billing ✅
- [x] checkAndDeductUsage قبل كل مرحلة
- [x] التحقق من الاشتراك (active/trial) والصلاحية
- [x] خصم usage_remaining وتسجيل في ai_usage_logs
- [x] رسائل خطأ عربية واضحة (FORBIDDEN, PRECONDITION_FAILED)

### 4. تحسين UX ✅
- [x] حالة واضحة لكل خطوة (pending/running/done/error)
- [x] زر retry لكل مرحلة فاشلة
- [x] عرض الاستخدام المتبقي لكل إضافة
- [x] تحذير عند عدم كفاية الرصيد
- [x] خيار "إعادة التوليد" switch

### 5. توثيق وتأكيد ✅
- [x] 19 اختبار Vitest لـ Golden Path
- [x] 80 اختبار إجمالي يمر بنجاح
- [x] checkpoint نهائي (7ac692f3)


## Shipping Intelligence Engine (Post-Sale Automation)
### 1. Data Model
- [ ] إنشاء جدول shipping_events في Supabase
- [ ] تعريف الحالات الموحدة (CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED)
- [ ] إضافة أنواع TypeScript

### 2. Ingestion APIs
- [ ] Webhook endpoint لاستقبال تحديثات الشحن
- [ ] Polling API لتحديث الحالة يدوياً
- [ ] تخزين raw carrier response

### 3. Intelligence Logic
- [ ] كشف التأخير (delay detection)
- [ ] كشف الفشل والمرتجعات
- [ ] تحديد at_risk orders
- [ ] حدود زمنية قابلة للتكوين

### 4. Order Sync
- [ ] تحديث order.status تلقائياً
- [ ] فصل shipping status عن order lifecycle

### 5. Automation Hooks
- [ ] trigger: delayed_orders
- [ ] trigger: failed_deliveries
- [ ] trigger: returned_shipments

### 6. n8n Integration
- [ ] مثال workflow للـ polling
- [ ] توثيق كيفية ربط carriers

### 7. Testing & Docs
- [ ] اختبارات Vitest
- [ ] توثيق قصير
- [ ] checkpoint


## Carrier Performance Intelligence Engine ✅
### 1. Timeline Calculation ✅
- [x] حساب assignment_time, pickup_time, delivery_time
- [x] حساب pickup_delay, transit_time, delivery_time
- [x] حساب return_cycle_time

### 2. Carrier Metrics ✅
- [x] avg pickup time per carrier
- [x] avg delivery time per carrier
- [x] delivery success rate
- [x] return rate
- [x] failure reasons aggregation

### 3. Performance Scoring ✅
- [x] speed score (48h=100, 96h=50)
- [x] reliability score (من success rate)
- [x] return rate score (lower=better)
- [x] overall carrier score (weighted)
- [x] tier assignment (excellent/good/average/poor)

### 4. Insights & Routing ✅
- [x] weak/strong carrier detection
- [x] abnormal delay detection
- [x] best carrier per region
- [x] best carrier per payment method (COD/prepaid)
- [x] alternative carriers recommendations

### 5. Testing & Documentation ✅
- [x] 32 اختبار Vitest
- [x] 136 اختبار إجمالي
- [x] checkpoint (6b5c5188)


## Shipping Automation Add-on (Paid Service) ✅
### 1. Add-on Definition ✅
- [x] إضافة "shipping_automation" في ai_addons
- [x] تفعيل trial (14 يوم، 50 وحدة)
- [x] monthly renewal + usage metering (99$/شهر، 500 وحدة)

### 2. Integration Modes ✅
- [x] API/Webhook mode (مع endpoint لكل carrier)
- [x] Sheet Import mode (CSV/Excel)
- [x] Column mapping per carrier (aramex, smsa, dhl, generic)
- [x] RPA Portal mode (stub لـ n8n)

### 3. COD Tracking ✅
- [x] إضافة حقول: cod_amount, cod_collected, cod_collected_at
- [x] تحديث order status تلقائياً

### 4. Usage Metering ✅
- [x] Sheet Import = 1 unit
- [x] RPA run = 1 unit
- [x] Block when exhausted (PRECONDITION_FAILED)
- [x] Log usage to ai_usage_logs

### 5. Integrations UI ✅
- [x] صفحة /integrations
- [x] تفعيل Add-on (تجريبي)
- [x] اختيار mode per carrier (API/Sheet/RPA)
- [x] Sheet upload UI مع preview
- [x] Last sync time + result

### 6. Testing ✅
- [x] 40 اختبار Vitest
- [x] 177 اختبار إجمالي
- [ ] checkpoint


## Smart Routing Engine ✅
### 1. Scoring Engine ✅
- [x] أوزان قابلة للتكوين (6 عوامل مجموعها = 1)
- [x] حساب score per carrier (weighted)
- [x] دعم region performance bonus

### 2. Recommendation Engine ✅
- [x] إرجاع best carrier + backup
- [x] confidence score (high/medium/low)
- [x] human-readable reasoning (عربي + إنجليزي)

### 3. Order Integration ✅
- [x] getRecommendation API
- [x] saveDecision API
- [x] حفظ: recommended_carrier, chosen_carrier, score, confidence, reasoning, overridden_by

### 4. Rules & Overrides ✅
- [x] فلترة COD (carriers بأداء COD >= 60%)
- [x] Super Admin: setCarrierOverride (force/disable)
- [x] Super Admin: updateWeights

### 5. Testing ✅
- [x] 38 اختبار Vitest
- [x] 215 اختبار إجمالي
- [x] checkpoint (595445c1)


### Profit Intelligence Engine (Per-Order P&L) ✅
### 1. Data Model ✅
- [x] order_costs table (cogs, shipping_cost, cod_fee, gateway_fee, return_cost, ad_spend, ai_cost)
- [x] order_pnl table/view (revenue, total_cost, net_profit, margin, status, loss_reasons)

### 2. Revenue Rules ✅
- [x] delivered + prepaid = confirmed
- [x] delivered + COD collected = confirmed
- [x] failed/returned = adjusted revenue (0)

### 3. Cost Sources ✅
- [x] shipping_cost from shipments table
- [x] cod_fee (configurable %)
- [x] ai_cost from usage logs (configurable rate)
- [x] ad_spend allocation (from campaign_daily_spend)
- [x] platform_fee from config

### 4. Recomputation ✅
- [x] computeOrderPnL API
- [x] batchRecompute API (all orders)
- [x] إعادة الحساب عند تغيير الحالة

### 5. Insights ✅
- [x] top 3 loss reasons per order
- [x] structured output (lossReasons array)

### 6. Super Admin ✅
- [x] overrideCost API
- [x] force recompute

### 7. UI ✅
- [x] /profit - Orders P&L list view
- [x] profit/loss/pending status badges
- [x] Products tab مع price insights
- [x] COD Cashflow summary

### 8. Testing ✅
- [x] 48 اختبار Vitest
- [x] 263 اختبار إجمالي
- [x] checkpoint (f29cc8b5)

### Extension: Product & Time Analytics ✅
- [x] getDailySnapshots API
- [x] listProductSnapshots API
- [x] Product Financial Profile (avg costs, return_rate, failed_rate)
- [x] Minimum Price Calculation (break-even, 10%, 20%)
- [x] COD settlement delay tracking (avgSettlementDays)
- [x] Profit pending until COD confirmed
- [x] getInsights API (most profitable, losing, high shipping, high return)


## Inventory & Procurement Engine ✅
### 1. Inventory Core ✅
- [x] products: quantity, reserved_stock (via metadata), cost, low_stock_threshold
- [x] Stock updates: sales (deductStock), receiving (receivePurchaseOrder), returns, adjustments

### 2. Stock Ledger ✅
- [x] stock_movements مع fallback للذاكرة
- [x] types: in, out, return, adjustment, purchase

### 3. Suppliers ✅
- [x] listSuppliers, createSupplier, updateSupplier APIs
- [x] Supplier profiles مع payment_terms

### 4. Purchase Orders ✅
- [x] createPurchaseOrder, listPurchaseOrders APIs
- [x] receivePurchaseOrder API
- [x] statuses: draft, sent, partially_received, received, cancelled

### 5. Purchase Invoices (Stub)
- [x] هيكل جاهز للتوسع
- [x] updateProductCost API

### 6. Alerts & Integration ✅
- [x] getLowStockAlerts API (critical/warning)
- [x] getDelayedPOAlerts API (days overdue)
- [x] reserveStock, releaseStock, deductStock APIs
- [x] getProductCOGS لـ Profit Intelligence

### 7. Testing ✅
- [x] 31 اختبار Vitest
- [x] 294 اختبار إجمالي
- [x] checkpoint (b14587ca)


## Operational UX (Correctness-First) ✅
### 1. Inventory UI ✅
- [x] Product list with current, reserved, available stock
- [x] Reorder level + status badges (low/ok)
- [x] View stock movements (read-only)
- [x] Manual adjustment (restricted)

### 2. Purchasing UI ✅
- [x] Suppliers: create, list
- [x] Purchase Orders: create, list
- [x] PO receiving: partial/full
- [x] PO status tracking (draft/sent/received)

### 3. Orders Integration ✅
- [x] Show stock status per order (محجوز/مخصوم)
- [x] Show COGS (read-only)
- [x] Tooltips للتوضيح

### 4. n8n Workflows ✅
- [x] Low stock alert (every 6 hours)
- [x] Delayed PO alert (daily)

### 5. Manual Acceptance Test ✅
- [x] دليل اختبار القبول اليدوي (docs/manual-acceptance-test.md)
- [x] 294 اختبار Vitest
- [x] checkpoint (aaf8cd32)


## Security & Hardening (No New Features) ✅
### 1. Multi-tenant Security ✅
- [x] Audit all tables have tenant_id (backend enforcement)
- [x] 36 cross-tenant access denial tests

### 2. Money Safety ✅
- [x] Idempotency keys for wallet deductions
- [x] Prevent double-charge (returns duplicate flag)
- [x] Immutable audit logs (balance_before/after)

### 3. Inventory Safety ✅
- [x] No negative stock invariant (PRECONDITION_FAILED)
- [x] Reserve <= available invariant
- [x] Stock movement logging for every change

### 4. Purchasing Safety ✅
- [x] Prevent double receive (blocks received/cancelled PO)
- [x] Validate partial receiving

### 5. Permissions Enforcement ✅
- [x] tenantProcedure for all tenant operations
- [x] superAdminProcedure for admin operations
- [x] 5 permission enforcement tests

### 6. n8n Hardening ✅
- [x] Webhook signature structure
- [x] Timestamp validation (replay prevention)
- [x] 2 webhook security tests

### 7. Documentation & Testing ✅
- [x] SECURITY_CHECKLIST.md
- [x] 51 security tests (345 total)
- [x] checkpoint (f1b59f7a)


## Observability & Financial Truth
### 1. Audit Log UI (Read-only)
- [ ] API: getAuditLogs (wallet, orders, inventory, AI usage)
- [ ] Tenant scoped + Super Admin full access
- [ ] صفحة /audit-log

### 2. Profit Truth Engine
- [ ] Track estimated vs finalized profit
- [ ] Finalize profit after COD collection
- [ ] Aggregate by order / product / day / channel
- [ ] API: getProfitTruth

### 3. Shipping Intelligence (Verify Existing)
- [ ] التحقق من carrierPerformance APIs
- [ ] التحقق من scoring و recommendations

### 4. Testing
- [ ] اختبارات Vitest
- [ ] checkpoint


## Observability & Financial Truth Phase
### 1. Audit Log UI (Read-Only)
- [x] إنشاء صفحة /audit للمراجعة
- [x] عرض wallet_transactions بشكل tenant-scoped
- [x] عرض orders و order_pnl
- [x] عرض stock_movements
- [x] عرض ai_usage_logs
- [x] Super Admin: عرض cross-tenant
- [x] فلترة بالتاريخ والنوع

### 2. Profit Truth Engine
- [x] التحقق من estimated vs finalized profit
- [x] التحقق من COD collection finalization
- [x] التحقق من aggregations (order/product/day/channel)
- [x] التحقق من variable cost allocation accuracy

### 3. Shipping Intelligence Verification
- [x] التحقق من carrier performance metrics (32 اختبار)
- [x] التحقق من scoring system (speed, reliability, return rate)
- [x] التحقق من strengths/weaknesses detection
- [x] التحقق من recommendations (38 اختبار smart routing)

### 4. Shipping Integration Add-on
- [x] التحقق من CSV/Excel upload implementation (processSheetImport API)
- [x] التحقق من usage metering (checkAndDeductUsage)
- [x] التحقق من billing integration (41 اختبار)


## Next.js Frontend Migration + n8n Automation Blueprint

### Part A: Next.js App Router Migration
- [ ] إنشاء Next.js App Router shell مع RTL (deferred - التركيز على Backend أولاً)
- [ ] نقل Auth + Layout + Navigation (deferred)
- [ ] نقل Home Dashboard (deferred)
- [x] الحفاظ على React app الحالي أثناء النقل

### Part B: AUTOMATION_BLUEPRINT.md
- [x] إنشاء AUTOMATION_BLUEPRINT.md
- [x] جدول لكل workflow (name, trigger, input, output, idempotency, retries, etc.)
- [x] Dataflow diagram section

### Part C: 5 Critical Workflows
- [x] Workflow 1: Order Created → Reserve Stock
- [x] Workflow 2: Order Fulfilled → Deduct Stock + COGS + P&L
- [x] Workflow 3: Shipping Status Sync → shipping_events + order status
- [x] Workflow 4: COD Settlement Sync → finalize profit
- [x] Workflow 5: Low Stock Alert → email + audit log


## Ownership & Control Phase (Senior Engineer Mode)

### Documentation
- [x] ARCHITECTURE_OWNERSHIP.md - stack choices, AI boundaries, operability without AI
- [x] AUTOMATION_AUTHORITY.md - full n8n workflow map, data sources, failure handling

### Next.js Incremental Migration
- [x] Next.js App Router shell with RTL
- [x] Auth integration (OAuth compatible)
- [x] Layout + Navigation (DashboardLayout)
- [x] Dashboard migration (read-only)
