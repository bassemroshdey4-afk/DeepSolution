/**
 * Privacy Policy Page
 * 
 * Simple privacy policy for SaaS platform.
 * Required for Google OAuth consent screen approval.
 */

import Link from 'next/link';

export const metadata = {
  title: 'سياسة الخصوصية | Deep Solution',
  description: 'سياسة الخصوصية لمنصة Deep Solution لإدارة التجارة الإلكترونية',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-white">DS</span>
            </div>
            <span className="font-semibold text-foreground">Deep Solution</span>
          </Link>
          <Link 
            href="/login" 
            className="text-sm text-primary hover:underline"
          >
            تسجيل الدخول
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8 text-center">
          سياسة الخصوصية
        </h1>
        
        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-right" dir="rtl">
          <p className="text-muted-foreground text-lg">
            آخر تحديث: يناير 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. مقدمة</h2>
            <p className="text-muted-foreground leading-relaxed">
              نحن في Deep Solution نلتزم بحماية خصوصيتك. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية معلوماتك الشخصية عند استخدام منصتنا لإدارة التجارة الإلكترونية.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. المعلومات التي نجمعها</h2>
            <p className="text-muted-foreground leading-relaxed">
              نجمع المعلومات التالية عند استخدامك لخدماتنا:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
              <li>معلومات الحساب: الاسم، البريد الإلكتروني، صورة الملف الشخصي (من Google)</li>
              <li>بيانات الأعمال: معلومات المتجر، المنتجات، الطلبات، المخزون</li>
              <li>بيانات الاستخدام: سجلات الدخول، النشاط على المنصة</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. كيف نستخدم معلوماتك</h2>
            <p className="text-muted-foreground leading-relaxed">
              نستخدم معلوماتك للأغراض التالية:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
              <li>توفير خدمات إدارة التجارة الإلكترونية</li>
              <li>تحسين تجربة المستخدم والمنصة</li>
              <li>التواصل معك بشأن حسابك وخدماتنا</li>
              <li>ضمان أمان المنصة ومنع الاحتيال</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. مشاركة البيانات</h2>
            <p className="text-muted-foreground leading-relaxed">
              لا نبيع معلوماتك الشخصية لأطراف ثالثة. قد نشارك البيانات مع:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
              <li>مزودي الخدمات الموثوقين (مثل Supabase للمصادقة)</li>
              <li>السلطات القانونية عند الضرورة</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. أمان البيانات</h2>
            <p className="text-muted-foreground leading-relaxed">
              نستخدم تقنيات أمان متقدمة لحماية بياناتك، بما في ذلك التشفير وعزل البيانات متعدد المستأجرين (Multi-tenant isolation) وسياسات أمان على مستوى الصفوف (Row Level Security).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. حقوقك</h2>
            <p className="text-muted-foreground leading-relaxed">
              لديك الحق في:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
              <li>الوصول إلى بياناتك الشخصية</li>
              <li>تصحيح البيانات غير الدقيقة</li>
              <li>طلب حذف حسابك وبياناتك</li>
              <li>تصدير بياناتك</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. ملفات تعريف الارتباط (Cookies)</h2>
            <p className="text-muted-foreground leading-relaxed">
              نستخدم ملفات تعريف الارتباط الضرورية لتشغيل المنصة والحفاظ على جلسة تسجيل الدخول الخاصة بك.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. التواصل معنا</h2>
            <p className="text-muted-foreground leading-relaxed">
              إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه، يمكنك التواصل معنا عبر البريد الإلكتروني: support@deepsolution.app
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. التحديثات</h2>
            <p className="text-muted-foreground leading-relaxed">
              قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار على المنصة.
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link 
            href="/" 
            className="text-primary hover:underline"
          >
            ← العودة للصفحة الرئيسية
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Deep Solution. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}
