# البنية المعمارية لمنصة DeepSolution

## نظرة عامة

منصة **DeepSolution** هي نظام SaaS متعدد المستأجرين (Multi-tenant) مصمم لإدارة التجارة الإلكترونية والتسويق بالذكاء الاصطناعي. تعتمد المنصة على عزل تام للبيانات بين المستأجرين مع واجهة عربية كاملة ودعم RTL.

## المكدس التقني

تستخدم المنصة المكدس التقني التالي المتوفر في البيئة الحالية:

- **Frontend**: React 19 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express 4 + tRPC 11
- **Database**: MySQL/TiDB عبر Drizzle ORM
- **Authentication**: Manus OAuth
- **AI Integration**: OpenAI API (عبر invokeLLM helper)
- **Storage**: S3 (عبر storage helpers)
- **Language**: TypeScript

## معمارية النظام متعدد المستأجرين

### مبدأ العزل التام

يعتمد النظام على نموذج **Shared Database with Tenant Isolation** حيث:

1. **tenant_id في كل جدول**: جميع الجداول (ما عدا tenants و users) تحتوي على عمود tenant_id
2. **فهارس مركبة**: كل جدول يحتوي على فهرس مركب (tenant_id, id) لتحسين الأداء
3. **Middleware للتحقق**: جميع tRPC procedures تتحقق من tenant_id قبل الوصول للبيانات
4. **دوال مساعدة**: جميع استعلامات قاعدة البيانات تمر عبر دوال تضيف tenant_id تلقائياً

### نموذج البيانات

#### الجداول الأساسية

**tenants** - جدول المستأجرين
- id (PK)
- name (اسم الشركة/المتجر)
- domain (نطاق فرعي فريد)
- plan (الخطة: free, pro, enterprise)
- status (active, suspended, trial)
- settings (JSON - إعدادات مخصصة)
- createdAt, updatedAt

**users** - جدول المستخدمين
- id (PK)
- openId (من Manus OAuth)
- tenantId (FK -> tenants)
- role (owner, admin, agent, viewer)
- name, email
- createdAt, updatedAt, lastSignedIn

**products** - جدول المنتجات
- id (PK)
- tenantId (FK -> tenants)
- name, description
- price, cost
- sku, barcode
- imageUrl
- stock (الكمية المتاحة)
- status (active, draft, archived)
- createdAt, updatedAt

**orders** - جدول الطلبات
- id (PK)
- tenantId (FK -> tenants)
- orderNumber (رقم الطلب الفريد)
- customerName, customerPhone, customerAddress
- totalAmount
- status (new, confirmed, processing, shipped, delivered, cancelled)
- callCenterStatus (pending, contacted, callback, no_answer)
- shippingStatus (pending, in_transit, delivered)
- notes
- createdAt, updatedAt

**order_items** - عناصر الطلبات
- id (PK)
- tenantId (FK -> tenants)
- orderId (FK -> orders)
- productId (FK -> products)
- quantity, price
- createdAt

**campaigns** - جدول الحملات التسويقية
- id (PK)
- tenantId (FK -> tenants)
- name, description
- platform (facebook, google, tiktok, snapchat)
- budget (الميزانية)
- spent (المصروف الفعلي)
- revenue (الإيرادات المحققة)
- roas (العائد على الإنفاق الإعلاني)
- startDate, endDate
- status (active, paused, completed)
- createdAt, updatedAt

**landing_pages** - صفحات الهبوط المولدة
- id (PK)
- tenantId (FK -> tenants)
- productId (FK -> products)
- title, content (HTML/JSON)
- imageUrls (JSON array)
- aiPrompt (الوصف المستخدم للتوليد)
- status (draft, published)
- views, conversions
- createdAt, updatedAt

**ai_conversations** - محادثات المساعد الذكي
- id (PK)
- tenantId (FK -> tenants)
- userId (FK -> users)
- messages (JSON array - تاريخ المحادثة)
- context (JSON - سياق المحادثة)
- createdAt, updatedAt

## طبقة tRPC API

### هيكل الـ Routers

```
appRouter
├── auth (المصادقة)
│   ├── me
│   └── logout
├── tenant (إدارة المستأجرين)
│   ├── create (تسجيل مستأجر جديد)
│   ├── getCurrent
│   └── updateSettings
├── products (إدارة المنتجات)
│   ├── list
│   ├── create
│   ├── update
│   └── delete
├── orders (إدارة الطلبات)
│   ├── list
│   ├── get
│   ├── create
│   ├── updateStatus
│   └── updateCallCenterStatus
├── campaigns (إدارة الحملات)
│   ├── list
│   ├── create
│   ├── update
│   ├── calculateROAS
│   └── getAnalytics
├── landingPages (صفحات الهبوط)
│   ├── generate (توليد بالذكاء الاصطناعي)
│   ├── list
│   ├── get
│   └── publish
└── ai (المساعد الذكي)
    ├── chat
    ├── getHistory
    └── analyzeData
```

### نمط الحماية

جميع procedures (ما عدا tenant.create) تستخدم `protectedProcedure` وتتحقق من:
1. وجود مستخدم مصادق (ctx.user)
2. وجود tenant_id مرتبط بالمستخدم
3. صلاحيات المستخدم (role) للعمليات الحساسة

## طبقة الذكاء الاصطناعي

### مولد صفحات الهبوط

**التدفق:**
1. المستخدم يرفع صورة المنتج + وصف نصي
2. رفع الصورة إلى S3 عبر storagePut
3. استدعاء OpenAI Vision API لتحليل الصورة
4. استدعاء OpenAI GPT-4 لتوليد محتوى صفحة الهبوط (عنوان، وصف، نقاط بيع، CTA)
5. حفظ النتيجة في جدول landing_pages

**الـ Prompt المستخدم:**
```
أنت خبير في كتابة صفحات الهبوط للتجارة الإلكترونية.
بناءً على صورة المنتج والوصف التالي، قم بإنشاء صفحة هبوط احترافية بالعربية تتضمن:
- عنوان جذاب
- وصف مقنع
- 5 نقاط بيع رئيسية
- دعوة لاتخاذ إجراء (CTA)
```

### المساعد الذكي

**القدرات:**
1. الإجابة على أسئلة حول الطلبات والمنتجات
2. تحليل أداء الحملات التسويقية
3. تقديم توصيات لتحسين ROAS
4. إنشاء تقارير مخصصة

**نظام الذاكرة:**
- حفظ آخر 20 رسالة في ai_conversations.messages
- استخراج السياق من قاعدة البيانات (آخر الطلبات، المنتجات الأكثر مبيعاً، أداء الحملات)
- إرسال السياق مع كل استعلام لـ OpenAI

**الـ System Prompt:**
```
أنت مساعد ذكي متخصص في التجارة الإلكترونية والتسويق.
لديك وصول لبيانات المتجر التالية: [السياق]
أجب بالعربية بشكل احترافي ومفيد.
```

## الواجهة الأمامية

### دعم RTL والعربية

**إعدادات index.css:**
```css
html {
  direction: rtl;
}

body {
  font-family: 'Cairo', 'Tajawal', sans-serif;
}
```

**استخدام shadcn/ui:**
- جميع المكونات تدعم RTL تلقائياً
- استخدام `text-right` بدلاً من `text-left`
- عكس الهوامش: `mr-4` تصبح `ml-4`

### هيكل الصفحات

```
/
├── / (الصفحة الرئيسية - لوحة التحكم)
├── /products (إدارة المنتجات)
├── /orders (إدارة الطلبات)
├── /campaigns (إدارة الحملات)
├── /landing-pages (صفحات الهبوط)
├── /ai-assistant (المساعد الذكي)
├── /inventory (المخزون)
└── /settings (الإعدادات)
```

### مكونات مخصصة

- **DashboardLayout**: قالب أساسي مع قائمة جانبية عربية
- **OrdersTable**: جدول الطلبات مع فلترة وبحث
- **CampaignCard**: بطاقة عرض الحملة مع ROAS
- **AIChatInterface**: واجهة المساعد الذكي
- **LandingPageGenerator**: واجهة توليد صفحات الهبوط

## الأمان وعزل البيانات

### استراتيجيات الحماية

1. **Tenant Isolation Middleware**:
```typescript
// في كل procedure محمي
const tenantId = ctx.user.tenantId;
if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN' });
```

2. **Query Helpers مع tenant_id**:
```typescript
export async function getProductsByTenant(db, tenantId: number) {
  return db.select().from(products).where(eq(products.tenantId, tenantId));
}
```

3. **Validation مع Zod**:
```typescript
input: z.object({
  productId: z.number(),
  // لا نطلب tenantId من المستخدم - نأخذه من ctx
})
```

4. **Role-based Access Control**:
```typescript
if (ctx.user.role !== 'owner' && ctx.user.role !== 'admin') {
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

## حساب ROAS

**المعادلة:**
```
ROAS = (Revenue / Spent) × 100
```

**التطبيق:**
```typescript
async function calculateROAS(campaignId: number, tenantId: number) {
  const campaign = await getCampaign(campaignId, tenantId);
  const orders = await getOrdersByCampaign(campaignId, tenantId);
  
  const revenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const roas = campaign.spent > 0 ? (revenue / campaign.spent) * 100 : 0;
  
  await updateCampaign(campaignId, { revenue, roas });
  return { revenue, roas };
}
```

## تدفق تسجيل المستأجرين الجدد

1. المستخدم يزور صفحة التسجيل
2. يدخل معلومات الشركة (الاسم، النطاق الفرعي)
3. يتم إنشاء سجل في جدول tenants
4. يتم ربط المستخدم الحالي بالـ tenant كـ owner
5. إنشاء بيانات تجريبية اختيارية (منتجات، طلبات نموذجية)
6. توجيه المستخدم إلى لوحة التحكم

## الأداء والتحسينات

### الفهارس المطلوبة

```sql
-- فهارس tenant_id لجميع الجداول
CREATE INDEX idx_products_tenant ON products(tenantId);
CREATE INDEX idx_orders_tenant ON orders(tenantId);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenantId);

-- فهارس مركبة للاستعلامات الشائعة
CREATE INDEX idx_orders_tenant_status ON orders(tenantId, status);
CREATE INDEX idx_products_tenant_status ON products(tenantId, status);
```

### Caching Strategy

- استخدام React Query (من tRPC) لـ caching البيانات
- `staleTime` مناسب لكل نوع بيانات:
  - Products: 5 دقائق
  - Orders: 30 ثانية
  - Campaigns: دقيقة واحدة

## الاختبار

### اختبارات Vitest المطلوبة

1. **عزل البيانات**: التأكد من عدم تسرب البيانات بين المستأجرين
2. **CRUD Operations**: اختبار جميع عمليات الإنشاء والقراءة والتحديث والحذف
3. **ROAS Calculation**: اختبار دقة حساب ROAS
4. **AI Integration**: اختبار استدعاءات OpenAI (مع mocking)
5. **Authentication Flow**: اختبار تدفق المصادقة والصلاحيات

## خارطة الطريق

### المرحلة 1 (MVP)
- ✅ نظام المستأجرين المتعدد
- ✅ إدارة المنتجات والطلبات
- ✅ مولد صفحات الهبوط
- ✅ المساعد الذكي الأساسي
- ✅ تتبع الحملات وحساب ROAS

### المرحلة 2 (التحسينات)
- تكامل مع منصات الشحن
- تكامل مع بوابات الدفع
- تقارير متقدمة وتحليلات
- تطبيق الجوال

### المرحلة 3 (التوسع)
- API عامة للمطورين
- سوق للإضافات (Marketplace)
- تكامل مع منصات التواصل الاجتماعي
- أتمتة التسويق

## الخلاصة

منصة DeepSolution مصممة لتكون قابلة للتوسع والصيانة مع التركيز على الأمان وعزل البيانات. البنية المعمارية تدعم نمو المنصة من MVP إلى منتج enterprise-ready مع الحفاظ على الأداء وتجربة المستخدم.
