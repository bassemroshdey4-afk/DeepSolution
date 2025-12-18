# Profiles Table Structure

جدول profiles يحتوي على الأعمدة التالية:
- id: uuid (PRIMARY KEY)
- email: varchar
- name: varchar
- avatar_url: text
- default_tenant_id: uuid

## المشكلة المكتشفة

الخطأ: `insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"`

هذا يعني أن هناك foreign key على عمود `id` يشير إلى جدول آخر (على الأرجح `auth.users`).

## الحل

يجب إزالة الـ foreign key constraint أو تعديل دالة upsertUser لاستخدام UUID مستقل.
