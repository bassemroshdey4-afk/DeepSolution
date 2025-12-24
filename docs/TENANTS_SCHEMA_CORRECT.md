# Tenants Table Schema (Correct)

## Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | uuid | ✅ | Primary key |
| `name` | character varying | ✅ | Store name |
| `slug` | character varying | ✅ | Unique subdomain |
| `logo_url` | text | ❌ | Store logo URL |
| `country` | character varying | ❌ | Country code |
| `currency` | character varying | ❌ | Currency code |
| `language` | character varying | ❌ | Language code |
| `timezone` | character varying | ❌ | Timezone |
| `created_at` | timestamp with time zone | ❌ | Creation timestamp |
| `updated_at` | timestamp with time zone | ❌ | Update timestamp |

## Sample Insert

```sql
INSERT INTO tenants (id, name, slug, country, currency, language, timezone)
VALUES (
  gen_random_uuid(),
  'متجر الاختبار',
  'test-store',
  'SA',
  'SAR',
  'ar',
  'Asia/Riyadh'
);
```
