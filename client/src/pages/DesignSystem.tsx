/**
 * Design System Preview Page
 * 
 * This page demonstrates the Deep Solution design tokens
 * applied to sample components (buttons, cards, badges).
 * 
 * Access at: /design-system (dev only)
 */

import { useState } from 'react';

export default function DesignSystem() {
  const [density, setDensity] = useState<'dense' | 'comfortable' | 'spacious'>('comfortable');

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="ds-page-title mb-2">نظام التصميم</h1>
          <p className="ds-body text-muted-foreground">
            Deep Solution Design System - معاينة المكونات والألوان
          </p>
        </div>

        {/* Brand Colors */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">ألوان العلامة التجارية</h2>
          
          {/* Brand Gradient */}
          <div className="mb-8">
            <h3 className="ds-subsection mb-4">التدرج الرئيسي</h3>
            <div className="h-24 rounded-lg bg-ds-gradient flex items-center justify-center">
              <span className="text-white font-semibold text-lg">Deep Solution Gradient</span>
            </div>
          </div>

          {/* Blue Scale */}
          <div className="mb-6">
            <h3 className="ds-subsection mb-4">الأزرق الأساسي</h3>
            <div className="grid grid-cols-10 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                <div key={shade} className="text-center">
                  <div 
                    className="h-16 rounded-lg mb-2" 
                    style={{ backgroundColor: `var(--ds-blue-${shade})` }}
                  />
                  <span className="ds-tiny">{shade}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Teal Scale */}
          <div className="mb-6">
            <h3 className="ds-subsection mb-4">التركواز الثانوي</h3>
            <div className="grid grid-cols-10 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                <div key={shade} className="text-center">
                  <div 
                    className="h-16 rounded-lg mb-2" 
                    style={{ backgroundColor: `var(--ds-teal-${shade})` }}
                  />
                  <span className="ds-tiny">{shade}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Colors */}
          <div>
            <h3 className="ds-subsection mb-4">ألوان الحالة</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="h-16 rounded-lg mb-2" style={{ backgroundColor: 'var(--ds-success-500)' }} />
                <span className="ds-small">Success</span>
              </div>
              <div className="text-center">
                <div className="h-16 rounded-lg mb-2" style={{ backgroundColor: 'var(--ds-warning-500)' }} />
                <span className="ds-small">Warning</span>
              </div>
              <div className="text-center">
                <div className="h-16 rounded-lg mb-2" style={{ backgroundColor: 'var(--ds-error-500)' }} />
                <span className="ds-small">Error</span>
              </div>
              <div className="text-center">
                <div className="h-16 rounded-lg mb-2" style={{ backgroundColor: 'var(--ds-info-500)' }} />
                <span className="ds-small">Info</span>
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">الطباعة</h2>
          <div className="ds-card space-y-6">
            <div>
              <span className="ds-tiny text-muted-foreground">Display (48px)</span>
              <p className="ds-display">عنوان رئيسي كبير</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Page Title (32px)</span>
              <p className="ds-page-title">عنوان الصفحة</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Section Title (24px)</span>
              <p className="ds-section-title">عنوان القسم</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Subsection (20px)</span>
              <p className="ds-subsection">عنوان فرعي</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Body Large (18px)</span>
              <p className="ds-body-lg">نص أساسي كبير للفقرات المهمة</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Body (16px)</span>
              <p className="ds-body">نص أساسي عادي للمحتوى العام</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Body Small (14px)</span>
              <p className="ds-body-sm">نص صغير للتفاصيل الثانوية</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Small (13px)</span>
              <p className="ds-small">نص مساعد وتعليقات</p>
            </div>
            <div>
              <span className="ds-tiny text-muted-foreground">Tiny (12px)</span>
              <p className="ds-tiny">تسميات وشارات</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">الأزرار</h2>
          
          <div className="ds-card">
            <h3 className="ds-subsection mb-4">تسلسل الأزرار</h3>
            <div className="flex flex-wrap gap-4 mb-8">
              <button className="ds-btn ds-btn-primary">
                زر أساسي
              </button>
              <button className="ds-btn ds-btn-secondary">
                زر ثانوي
              </button>
              <button className="ds-btn ds-btn-danger">
                زر خطر
              </button>
              <button className="ds-btn ds-btn-ai">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                إجراء ذكي
              </button>
            </div>

            <h3 className="ds-subsection mb-4">حالات الأزرار</h3>
            <div className="flex flex-wrap gap-4 mb-8">
              <button className="ds-btn ds-btn-primary">عادي</button>
              <button className="ds-btn ds-btn-primary" disabled>معطل</button>
            </div>

            <h3 className="ds-subsection mb-4">أحجام الأزرار</h3>
            <div className="flex flex-wrap items-center gap-4">
              <button className="ds-btn ds-btn-primary" style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}>
                صغير جداً
              </button>
              <button className="ds-btn ds-btn-primary" style={{ height: '32px', padding: '0 14px', fontSize: '13px' }}>
                صغير
              </button>
              <button className="ds-btn ds-btn-primary">
                متوسط
              </button>
              <button className="ds-btn ds-btn-primary" style={{ height: '48px', padding: '0 20px', fontSize: '16px' }}>
                كبير
              </button>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">البطاقات</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Default Card */}
            <div className="ds-card">
              <div className="ds-card-header">
                <h3 className="ds-card-title">بطاقة افتراضية</h3>
                <p className="ds-card-description">وصف قصير للبطاقة</p>
              </div>
              <p className="ds-body-sm text-muted-foreground">
                محتوى البطاقة يظهر هنا مع نص توضيحي.
              </p>
            </div>

            {/* Stat Card */}
            <div className="ds-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-ds-gradient-subtle flex items-center justify-center">
                  <svg className="w-5 h-5 text-ds-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <span className="ds-body-sm text-muted-foreground">إجمالي الطلبات</span>
              </div>
              <p className="text-3xl font-bold tabular-nums">1,234</p>
              <p className="ds-small text-muted-foreground mt-1">
                <span className="text-green-600">+12%</span> من الشهر الماضي
              </p>
            </div>

            {/* Interactive Card */}
            <div className="ds-card cursor-pointer transition-all hover:border-gray-300 hover:shadow-md">
              <div className="ds-card-header">
                <h3 className="ds-card-title">بطاقة تفاعلية</h3>
                <p className="ds-card-description">انقر للمزيد</p>
              </div>
              <p className="ds-body-sm text-muted-foreground">
                هذه البطاقة قابلة للنقر وتتغير عند التمرير.
              </p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">الشارات</h2>
          
          <div className="ds-card">
            <h3 className="ds-subsection mb-4">شارات الحالة</h3>
            <div className="flex flex-wrap gap-3 mb-6">
              <span className="ds-badge ds-badge-success">نجح</span>
              <span className="ds-badge ds-badge-warning">قيد الانتظار</span>
              <span className="ds-badge ds-badge-error">فشل</span>
              <span className="ds-badge ds-badge-info">جديد</span>
              <span className="ds-badge ds-badge-neutral">مسودة</span>
            </div>

            <h3 className="ds-subsection mb-4">شارات مع أيقونات</h3>
            <div className="flex flex-wrap gap-3">
              <span className="ds-badge ds-badge-success">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                تم التوصيل
              </span>
              <span className="ds-badge ds-badge-warning">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                قيد الشحن
              </span>
              <span className="ds-badge ds-badge-error">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                ملغي
              </span>
            </div>
          </div>
        </section>

        {/* Table States */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">حالات الجدول</h2>
          
          {/* Density Selector */}
          <div className="mb-4 flex gap-2">
            <button 
              onClick={() => setDensity('dense')}
              className={`ds-btn ${density === 'dense' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
            >
              كثيف
            </button>
            <button 
              onClick={() => setDensity('comfortable')}
              className={`ds-btn ${density === 'comfortable' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
            >
              مريح
            </button>
            <button 
              onClick={() => setDensity('spacious')}
              className={`ds-btn ${density === 'spacious' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
            >
              واسع
            </button>
          </div>

          <div className="ds-card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className={`text-right ds-table-header ${
                    density === 'dense' ? 'py-2 px-3' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    رقم الطلب
                  </th>
                  <th className={`text-right ds-table-header ${
                    density === 'dense' ? 'py-2 px-3' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    العميل
                  </th>
                  <th className={`text-right ds-table-header ${
                    density === 'dense' ? 'py-2 px-3' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    الحالة
                  </th>
                  <th className={`text-right ds-table-header ${
                    density === 'dense' ? 'py-2 px-3' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    المبلغ
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Default Row */}
                <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    #1001
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    أحمد محمد
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    <span className="ds-badge ds-badge-success">تم التوصيل</span>
                  </td>
                  <td className={`tabular-nums ${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    150.00 ر.س
                  </td>
                </tr>
                
                {/* Selected Row */}
                <tr className="border-b border-border bg-blue-50 border-r-4 border-r-blue-500">
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    #1002
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    سارة علي
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    <span className="ds-badge ds-badge-warning">قيد الشحن</span>
                  </td>
                  <td className={`tabular-nums ${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    280.00 ر.س
                  </td>
                </tr>
                
                {/* Warning Row */}
                <tr className="border-b border-border bg-amber-50 border-r-4 border-r-amber-500">
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    #1003
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    خالد عمر
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    <span className="ds-badge ds-badge-warning">تأخر في التوصيل</span>
                  </td>
                  <td className={`tabular-nums ${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    95.00 ر.س
                  </td>
                </tr>
                
                {/* Error Row */}
                <tr className="border-b border-border bg-red-50 border-r-4 border-r-red-500">
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    #1004
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    فاطمة حسن
                  </td>
                  <td className={`${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    <span className="ds-badge ds-badge-error">ملغي</span>
                  </td>
                  <td className={`tabular-nums ${
                    density === 'dense' ? 'py-2 px-3 text-sm' : 
                    density === 'comfortable' ? 'py-3 px-4' : 'py-4 px-6'
                  }`}>
                    0.00 ر.س
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Gradient Text */}
        <section className="mb-12">
          <h2 className="ds-section-title mb-6">نص متدرج</h2>
          <div className="ds-card">
            <p className="ds-display ds-gradient-text">Deep Solution</p>
            <p className="ds-body-sm text-muted-foreground mt-2">
              نص بتدرج العلامة التجارية للعناوين المميزة
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
