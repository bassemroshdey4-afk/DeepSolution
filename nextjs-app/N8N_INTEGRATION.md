# n8n Integration Guide - DeepSolution

## نظرة عامة

هذا الدليل يشرح كيفية ربط منصة DeepSolution مع n8n للأتمتة.

## المتطلبات

- حساب n8n Cloud أو self-hosted instance
- API Key من n8n
- Supabase project مُعد مسبقاً

## Webhooks المتاحة للربط

### 1. Webhook: منتج جديد
```
POST /api/webhooks/product-created
```

**البيانات المُرسلة:**
```json
{
  "event": "product.created",
  "timestamp": "2024-12-24T00:00:00Z",
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "اسم المنتج",
    "sku": "SKU-001",
    "price": 150.00,
    "quantity": 50
  }
}
```

### 2. Webhook: مخزون منخفض
```
POST /api/webhooks/low-stock-alert
```

**البيانات المُرسلة:**
```json
{
  "event": "inventory.low_stock",
  "timestamp": "2024-12-24T00:00:00Z",
  "data": {
    "product_id": "uuid",
    "product_name": "اسم المنتج",
    "current_quantity": 5,
    "threshold": 10,
    "tenant_id": "uuid"
  }
}
```

### 3. Webhook: طلب جديد
```
POST /api/webhooks/order-created
```

**البيانات المُرسلة:**
```json
{
  "event": "order.created",
  "timestamp": "2024-12-24T00:00:00Z",
  "data": {
    "id": "uuid",
    "order_number": "ORD-001",
    "customer_name": "اسم العميل",
    "total": 500.00,
    "items_count": 3,
    "tenant_id": "uuid"
  }
}
```

---

## إعداد n8n Workflows

### Workflow 1: تنبيه المخزون المنخفض

**الخطوات:**
1. أضف node "Webhook" في n8n
2. اختر HTTP Method: POST
3. انسخ الـ Webhook URL
4. أضف الـ URL في إعدادات DeepSolution
5. أضف node "Telegram" أو "Email" للإشعارات

**مثال n8n Workflow JSON:**
```json
{
  "name": "Low Stock Alert",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "low-stock-alert"
      }
    },
    {
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "chatId": "YOUR_CHAT_ID",
        "text": "⚠️ تنبيه مخزون منخفض!\n\nالمنتج: {{$json.data.product_name}}\nالكمية الحالية: {{$json.data.current_quantity}}\nالحد الأدنى: {{$json.data.threshold}}"
      }
    }
  ]
}
```

### Workflow 2: إشعار طلب جديد

**الخطوات:**
1. أضف node "Webhook" في n8n
2. أضف node "Google Sheets" لتسجيل الطلبات
3. أضف node "Email" لإرسال تأكيد

---

## إعداد Supabase Database Webhooks

بدلاً من API webhooks، يمكن استخدام Supabase Database Webhooks مباشرة:

### 1. إنشاء Database Function
```sql
CREATE OR REPLACE FUNCTION notify_n8n_on_product_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-n8n-instance.app.n8n.cloud/webhook/product-created',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'event', 'product.created',
      'timestamp', NOW(),
      'data', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. إنشاء Trigger
```sql
CREATE TRIGGER product_insert_webhook
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION notify_n8n_on_product_insert();
```

---

## متغيرات البيئة المطلوبة

```env
# n8n Configuration
N8N_INSTANCE_URL=https://your-instance.app.n8n.cloud
N8N_API_KEY=your-api-key

# Webhook URLs (يتم تعبئتها من n8n)
N8N_WEBHOOK_PRODUCT_CREATED=https://your-instance.app.n8n.cloud/webhook/xxx
N8N_WEBHOOK_LOW_STOCK=https://your-instance.app.n8n.cloud/webhook/xxx
N8N_WEBHOOK_ORDER_CREATED=https://your-instance.app.n8n.cloud/webhook/xxx
```

---

## الخطوات التالية

1. [ ] إنشاء API routes للـ webhooks في Next.js
2. [ ] إضافة صفحة إعدادات الـ webhooks في لوحة التحكم
3. [ ] تفعيل Database triggers في Supabase
4. [ ] اختبار الـ workflows مع n8n

---

## الدعم

للمساعدة في إعداد n8n، راجع:
- [n8n Documentation](https://docs.n8n.io/)
- [Supabase Webhooks](https://supabase.com/docs/guides/database/webhooks)
