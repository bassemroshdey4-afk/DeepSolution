# Tenants Table Schema

Based on Supabase API Docs, the `tenants` table has the following columns:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | uuid | Yes | Primary key |
| name | varchar | Yes | Tenant name |
| slug | varchar | Yes | Unique slug/subdomain |
| logo_url | text | No | Logo URL |
| country | varchar | No | Country code |
| currency | varchar | No | Currency code |
| language | varchar | No | Language code |
| timezone | varchar | No | Timezone |
| created_at | timestamptz | No | Creation timestamp |
| updated_at | timestamptz | No | Update timestamp |

**Note:** The table does NOT have:
- `plan` column
- `status` column
- `subdomain` column (use `slug` instead)
- `trial_ends_at` column

## Fix Required

Update `src/lib/actions/products.ts` to use only existing columns:
- Use `slug` instead of `subdomain`
- Remove `plan`, `status`, `trial_ends_at`
