/**
 * Terms of Service Page
 * 
 * Simple terms of service for SaaS platform.
 * Required for Google OAuth consent screen approval.
 */

import Link from 'next/link';

export const metadata = {
  title: 'شروط الاستخدام | Deep Solution',
  description: 'شروط استخدام منصة Deep Solution لإدارة التجارة الإلكترونية',
};

export default function TermsPage() {
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
          شروط الاستخدام
        </h1>
        
        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-right" dir="rtl">
          <p className="text-muted-foreground text-lg">
            آخر تحديث: يناير 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. قبول الشروط</h2>
            <p className="text-muted-foreground leading-relaxed">
              باستخدامك لمنصة Deep Solution، فإنك توافق على الالتزام بشروط الاستخدام هذه. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام المنصة.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. وصف الخدمة</h2>
            <p className="text-muted-foreground leading-relaxed">
              Deep Solution هي منصة SaaS لإدارة التجارة الإلكترونية توفر أدوات لإدارة المنتجات، الطلبات، المخزون، الشحن، والحملات التسويقية. نحتفظ بالحق في تعديل أو إيقاف أي ميزة في أي وقت.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. حسابات المستخدمين</h2>
            <p className="text-muted-foreground leading-relaxed">
              أنت مسؤول عن:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
              <li>الحفاظ على سرية بيانات حسابك</li>
              <li>جميع الأنشطة التي تتم تحت حسابك</li>
              <li>إخطارنا فوراً بأي استخدام غير مصرح به</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. الاستخدام المقبول</h2>
            <p className="text-muted-foreground leading-relaxed">
              يجب عليك استخدام المنصة بطريقة قانونية ومسؤولة. يُحظر:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
              <li>انتهاك أي قوانين أو لوائح سارية</li>
              <li>محاولة الوصول غير المصرح به للأنظمة</li>
              <li>استخدام المنصة لأغراض احتيالية أو ضارة</li>
              <li>إرسال محتوى غير قانوني أو مسيء</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. الملكية الفكرية</h2>
            <p className="text-muted-foreground leading-relaxed">
              جميع حقوق الملكية الفكرية للمنصة وتصميمها وكودها تعود لـ Deep Solution. أنت تحتفظ بملكية بياناتك ومحتواك، لكنك تمنحنا ترخيصاً لاستخدامها لتقديم الخدمة.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. التسعير والدفع</h2>
            <p className="text-muted-foreground leading-relaxed">
              المنصة حالياً في مرحلة Alpha التجريبية. سيتم الإعلان عن خطط التسعير لاحقاً. نحتفظ بالحق في تقديم خدمات مدفوعة في المستقبل.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. إخلاء المسؤولية</h2>
            <p className="text-muted-foreground leading-relaxed">
              يتم تقديم المنصة "كما هي" دون أي ضمانات صريحة أو ضمنية. لا نضمن أن الخدمة ستكون متاحة دائماً أو خالية من الأخطاء. أنت تستخدم المنصة على مسؤوليتك الخاصة.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. حدود المسؤولية</h2>
            <p className="text-muted-foreground leading-relaxed">
              لن نكون مسؤولين عن أي أضرار مباشرة أو غير مباشرة أو عرضية أو تبعية ناتجة عن استخدامك للمنصة، بما في ذلك فقدان البيانات أو الأرباح.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. إنهاء الخدمة</h2>
            <p className="text-muted-foreground leading-relaxed">
              يمكننا تعليق أو إنهاء حسابك في أي وقت إذا انتهكت هذه الشروط. يمكنك أيضاً إلغاء حسابك في أي وقت عبر إعدادات الحساب.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">10. التعديلات</h2>
            <p className="text-muted-foreground leading-relaxed">
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنخطرك بالتغييرات الجوهرية. استمرارك في استخدام المنصة بعد التعديلات يعني موافقتك عليها.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">11. القانون الحاكم</h2>
            <p className="text-muted-foreground leading-relaxed">
              تخضع هذه الشروط للقوانين السارية. أي نزاعات ستتم تسويتها عبر التحكيم أو المحاكم المختصة.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">12. التواصل</h2>
            <p className="text-muted-foreground leading-relaxed">
              للاستفسارات حول شروط الاستخدام، تواصل معنا عبر: support@deepsolution.app
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
