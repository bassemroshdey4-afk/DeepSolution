# Deep Solution Design Commands

## نظرة عامة

هذا الدليل يحدد قرارات التصميم الأساسية لواجهة Deep Solution. الهدف هو ضمان اتساق التصميم عبر جميع الشاشات والمكونات، مع الحفاظ على مظهر احترافي يليق بمنتج SaaS عالمي.

---

## كثافة التخطيط (Layout Density)

نظام Deep Solution يدعم ثلاثة مستويات من كثافة التخطيط لتناسب مختلف حالات الاستخدام وتفضيلات المستخدمين.

### Dense (كثيف)

مناسب للجداول الكبيرة ولوحات البيانات حيث يحتاج المستخدم لرؤية أكبر قدر من المعلومات.

| الخاصية | القيمة |
|---------|--------|
| Row Height | 36px |
| Cell Padding | 8px 12px |
| Font Size | 13px (--ds-text-small) |
| Icon Size | 16px |
| Gap | 8px |

```css
.layout-dense {
  --layout-row-height: 36px;
  --layout-cell-padding: 0.5rem 0.75rem;
  --layout-font-size: var(--ds-text-small);
  --layout-icon-size: 1rem;
  --layout-gap: 0.5rem;
}
```

### Comfortable (مريح) - الافتراضي

التوازن المثالي بين كثافة المعلومات وراحة القراءة. هذا هو الإعداد الافتراضي.

| الخاصية | القيمة |
|---------|--------|
| Row Height | 48px |
| Cell Padding | 12px 16px |
| Font Size | 14px (--ds-text-body-sm) |
| Icon Size | 20px |
| Gap | 12px |

```css
.layout-comfortable {
  --layout-row-height: 48px;
  --layout-cell-padding: 0.75rem 1rem;
  --layout-font-size: var(--ds-text-body-sm);
  --layout-icon-size: 1.25rem;
  --layout-gap: 0.75rem;
}
```

### Spacious (واسع)

مناسب للعروض التقديمية والشاشات الكبيرة حيث الوضوح أهم من الكثافة.

| الخاصية | القيمة |
|---------|--------|
| Row Height | 64px |
| Cell Padding | 16px 24px |
| Font Size | 16px (--ds-text-body) |
| Icon Size | 24px |
| Gap | 16px |

```css
.layout-spacious {
  --layout-row-height: 64px;
  --layout-cell-padding: 1rem 1.5rem;
  --layout-font-size: var(--ds-text-body);
  --layout-icon-size: 1.5rem;
  --layout-gap: 1rem;
}
```

---

## تسلسل الأزرار (Button Hierarchy)

### Primary (أساسي)

الإجراء الرئيسي في الصفحة. يجب أن يكون هناك زر أساسي واحد فقط لكل سياق.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-blue-500) |
| Text Color | white |
| Border | none |
| Shadow | var(--ds-shadow-sm) |
| Hover | var(--ds-blue-600) |

**الاستخدام**: حفظ، إرسال، تأكيد، إنشاء جديد

```jsx
<button className="ds-btn ds-btn-primary">احفظ</button>
```

### Secondary (ثانوي)

الإجراءات الثانوية التي تدعم الإجراء الرئيسي.

| الخاصية | القيمة |
|---------|--------|
| Background | transparent |
| Text Color | var(--ds-fg-primary) |
| Border | 1px solid var(--ds-border-default) |
| Hover | var(--ds-gray-100) |

**الاستخدام**: إلغاء، رجوع، عرض التفاصيل

```jsx
<button className="ds-btn ds-btn-secondary">إلغاء</button>
```

### Danger (خطر)

الإجراءات التدميرية التي لا يمكن التراجع عنها.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-error-500) |
| Text Color | white |
| Border | none |
| Hover | var(--ds-error-600) |

**الاستخدام**: حذف، إزالة، إلغاء الاشتراك

```jsx
<button className="ds-btn ds-btn-danger">احذف</button>
```

### AI Action (إجراء ذكي)

الإجراءات المدعومة بالذكاء الاصطناعي. تتميز بتدرج لوني خاص.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-ai-gradient) |
| Text Color | white |
| Border | none |
| Hover | box-shadow: var(--ds-ai-glow) |
| Animation | shimmer effect on hover |

**الاستخدام**: اقتراح، تحليل، توليد، مساعدة

```jsx
<button className="ds-btn ds-btn-ai">
  <SparklesIcon className="w-4 h-4" />
  اقترح
</button>
```

### Ghost (شبح)

أزرار بدون خلفية للإجراءات الأقل أهمية.

| الخاصية | القيمة |
|---------|--------|
| Background | transparent |
| Text Color | var(--ds-fg-secondary) |
| Border | none |
| Hover | var(--ds-gray-100) |

**الاستخدام**: أيقونات الإجراءات، روابط ثانوية

```jsx
<button className="ds-btn ds-btn-ghost">
  <MoreIcon className="w-4 h-4" />
</button>
```

---

## أحجام الأزرار

| الحجم | Height | Padding | Font Size |
|------|--------|---------|-----------|
| xs | 28px | 8px 12px | 12px |
| sm | 32px | 8px 14px | 13px |
| md (default) | 40px | 10px 16px | 14px |
| lg | 48px | 12px 20px | 16px |
| xl | 56px | 14px 24px | 18px |

---

## حالات الجداول (Table States)

### Default (افتراضي)

الحالة الطبيعية للصف.

| الخاصية | القيمة |
|---------|--------|
| Background | transparent |
| Border Bottom | 1px solid var(--ds-border-subtle) |
| Text Color | var(--ds-fg-primary) |

### Hover (تمرير)

عند تمرير الماوس فوق الصف.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-gray-50) |
| Cursor | pointer (إذا كان قابل للنقر) |

### Selected (محدد)

عند تحديد الصف.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-blue-50) |
| Border Right | 3px solid var(--ds-blue-500) |

### Warning (تحذير)

صفوف تحتاج انتباه المستخدم.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-warning-50) |
| Border Right | 3px solid var(--ds-warning-500) |

### Error (خطأ)

صفوف بها مشاكل.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-error-50) |
| Border Right | 3px solid var(--ds-error-500) |

### Disabled (معطل)

صفوف غير قابلة للتفاعل.

| الخاصية | القيمة |
|---------|--------|
| Background | var(--ds-gray-50) |
| Text Color | var(--ds-fg-muted) |
| Opacity | 0.6 |

---

## البطاقات (Cards)

### Default Card

البطاقة الأساسية للمحتوى.

```css
.ds-card {
  background: var(--card);
  border: 1px solid var(--ds-border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--ds-shadow-sm);
  padding: 1.25rem;
}
```

### Interactive Card

بطاقة قابلة للنقر.

```css
.ds-card-interactive {
  cursor: pointer;
  transition: all 0.15s ease;
}

.ds-card-interactive:hover {
  border-color: var(--ds-border-strong);
  box-shadow: var(--ds-shadow-md);
}
```

### Stat Card

بطاقة الإحصائيات في لوحة التحكم.

```css
.ds-stat-card {
  background: var(--card);
  border: 1px solid var(--ds-border-default);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.ds-stat-card-value {
  font-size: var(--ds-text-page-title);
  font-weight: var(--ds-font-bold);
  color: var(--ds-fg-primary);
}

.ds-stat-card-label {
  font-size: var(--ds-text-body-sm);
  color: var(--ds-fg-secondary);
  margin-top: 0.25rem;
}
```

---

## الشارات (Badges)

### Status Badges

| الحالة | الفئة | الاستخدام |
|-------|------|----------|
| Success | ds-badge-success | تم، نجح، مكتمل |
| Warning | ds-badge-warning | قيد الانتظار، تحذير |
| Error | ds-badge-error | فشل، خطأ، ملغي |
| Info | ds-badge-info | جديد، معلومة |
| Neutral | ds-badge-neutral | مسودة، غير نشط |

### Badge Sizes

| الحجم | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 20px | 4px 8px | 11px |
| md (default) | 24px | 4px 10px | 12px |
| lg | 28px | 6px 12px | 13px |

---

## المسافات (Spacing)

نظام المسافات مبني على مضاعفات 4px.

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Tight spacing |
| --space-2 | 8px | Default gap |
| --space-3 | 12px | Component padding |
| --space-4 | 16px | Section spacing |
| --space-5 | 20px | Card padding |
| --space-6 | 24px | Large spacing |
| --space-8 | 32px | Section gaps |
| --space-10 | 40px | Page sections |
| --space-12 | 48px | Major sections |
| --space-16 | 64px | Page margins |

---

## الظلال (Shadows)

| Token | Usage |
|-------|-------|
| --ds-shadow-sm | Cards, buttons |
| --ds-shadow-md | Dropdowns, popovers |
| --ds-shadow-lg | Modals, dialogs |
| --ds-shadow-xl | Floating elements |

---

## الانتقالات (Transitions)

| Type | Duration | Easing |
|------|----------|--------|
| Fast | 100ms | ease-out |
| Normal | 150ms | ease |
| Slow | 300ms | ease-in-out |
| Smooth | 200ms | cubic-bezier(0.4, 0, 0.2, 1) |

```css
.transition-fast { transition: all 100ms ease-out; }
.transition-normal { transition: all 150ms ease; }
.transition-slow { transition: all 300ms ease-in-out; }
.transition-smooth { transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1); }
```

---

## إرشادات الاستخدام

### متى تستخدم كل نوع زر

| السيناريو | نوع الزر |
|----------|---------|
| الإجراء الرئيسي في الصفحة | Primary |
| إلغاء أو رجوع | Secondary |
| حذف أو إزالة | Danger |
| اقتراح أو تحليل AI | AI Action |
| إجراءات ثانوية في الجدول | Ghost |

### متى تستخدم كل كثافة

| السيناريو | الكثافة |
|----------|---------|
| جداول البيانات الكبيرة | Dense |
| الاستخدام اليومي العادي | Comfortable |
| العروض التقديمية | Spacious |
| الشاشات الصغيرة | Dense أو Comfortable |

### قواعد عامة

1. **زر أساسي واحد** لكل سياق
2. **الأزرار الخطرة** تحتاج تأكيد دائماً
3. **أزرار AI** تُستخدم فقط للميزات المدعومة بالذكاء الاصطناعي
4. **الشارات** للحالات فقط، ليست للإجراءات
5. **البطاقات التفاعلية** يجب أن تظهر تغيير واضح عند التمرير
