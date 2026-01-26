# n8n Integration Setup

## المتطلبات

1. حساب n8n (مجاني على n8n.cloud أو self-hosted)
2. API Key من n8n

---

## الخطوات

### 1. إنشاء حساب n8n

- اذهب إلى: https://app.n8n.cloud
- سجل حساب جديد أو سجل دخول

### 2. الحصول على API Key

1. افتح n8n Dashboard
2. اضغط على أيقونة الإعدادات (⚙️) في الأسفل
3. اختر **Settings** → **API**
4. اضغط **Create API Key**
5. انسخ الـ API Key

### 3. إضافة Environment Variables

في Vercel → Settings → Environment Variables:

| Variable | Value | مثال |
|----------|-------|------|
| `N8N_INSTANCE_URL` | رابط n8n الخاص بك | `https://bassem-workspace.app.n8n.cloud` |
| `N8N_API_KEY` | الـ API Key | `eyJhbGciOiJIUzI1NiIs...` |

**ملاحظة مهمة:** 
- استخدم الرابط الأساسي فقط (بدون `/mcp-server/http`)
- لا تضع `/` في نهاية الرابط

---

## التحقق من الاتصال

بعد إضافة المتغيرات:

1. أعد deploy على Vercel
2. افتح: `https://deepsolution.vercel.app/api/n8n/status`
3. يجب أن ترى:
```json
{
  "configured": true,
  "connected": true,
  "workflowCount": 0,
  "message": "Connected to n8n. Found 0 workflows."
}
```

---

## استخدام n8n مع DeepSolution

### Webhooks

يمكنك استدعاء webhooks من DeepSolution:

```typescript
import { triggerWebhook } from '@/lib/n8n';

// استدعاء webhook
const result = await triggerWebhook('new-order', {
  orderId: '123',
  customerEmail: 'customer@example.com',
});
```

### تنفيذ Workflow

```typescript
import { executeWorkflow } from '@/lib/n8n';

// تنفيذ workflow بالـ ID
const result = await executeWorkflow('workflow-id', {
  data: 'your data here',
});
```

---

## Workflows المقترحة

### 1. إشعار طلب جديد
- Trigger: Webhook من DeepSolution
- Actions: إرسال إيميل، إشعار Slack، تحديث Google Sheet

### 2. متابعة العملاء
- Trigger: Cron (يومي)
- Actions: جلب العملاء غير النشطين، إرسال إيميل تذكير

### 3. تحديث المخزون
- Trigger: Webhook عند تغيير المخزون
- Actions: تحديث المنتجات في المتاجر الخارجية

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| `n8n not configured` | أضف `N8N_INSTANCE_URL` و `N8N_API_KEY` |
| `Invalid API key` | تأكد من صحة الـ API Key أو أنشئ واحد جديد |
| `Connection failed` | تأكد من صحة الـ URL (بدون `/mcp-server/http`) |
