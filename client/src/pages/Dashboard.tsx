import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, TrendingUp, DollarSign, Loader2, Clock, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "wouter";

// مكون شريط حالة الاشتراك
function SubscriptionBanner() {
  const { data: subscriptionData, isLoading, error } = trpc.tenant.getSubscription.useQuery(undefined, {
    retry: false,
  });

  // Show loading state
  if (isLoading) {
    return (
      <Alert className="mb-6 border-gray-300 bg-gray-50">
        <Clock className="h-5 w-5 text-gray-600" />
        <AlertTitle className="font-bold text-gray-800">جاري التحميل...</AlertTitle>
      </Alert>
    );
  }

  // If error or no data, show trial banner with default values
  const subscription = subscriptionData?.subscription;
  const isTrialActive = subscriptionData?.isTrialActive ?? true; // Default to true for trial

  // حساب الأيام المتبقية من Trial
  const getDaysRemaining = () => {
    if (!subscription?.trial_ends_at) return 7; // Default 7 days for new trials
    const trialEnd = new Date(subscription.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const daysRemaining = getDaysRemaining();
  const status = subscription?.status || "trial"; // Default to trial

  // إذا كان في فترة تجريبية أو لا يوجد subscription
  if (isTrialActive || status === "trial" || !subscription) {
    const isUrgent = daysRemaining <= 3;
    
    return (
      <Alert className={`mb-6 ${isUrgent ? "border-orange-500 bg-orange-50" : "border-blue-500 bg-blue-50"}`}>
        <Clock className={`h-5 w-5 ${isUrgent ? "text-orange-600" : "text-blue-600"}`} />
        <AlertTitle className={`font-bold ${isUrgent ? "text-orange-800" : "text-blue-800"}`}>
          الفترة التجريبية
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
          <div className={`${isUrgent ? "text-orange-700" : "text-blue-700"}`}>
            {isUrgent ? (
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                تبقى <strong>{daysRemaining}</strong> {daysRemaining === 1 ? "يوم" : "أيام"} فقط على انتهاء الفترة التجريبية!
              </span>
            ) : (
              <span>
                تبقى <strong>{daysRemaining}</strong> يوم على انتهاء الفترة التجريبية. استمتع بجميع الميزات مجاناً!
              </span>
            )}
          </div>
          <Button size="sm" variant={isUrgent ? "default" : "outline"} className={isUrgent ? "bg-orange-600 hover:bg-orange-700" : ""}>
            <Sparkles className="h-4 w-4 ml-2" />
            ترقية الآن
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // إذا انتهت الفترة التجريبية
  if (status === "expired" || (status === "trial" && daysRemaining === 0)) {
    return (
      <Alert className="mb-6 border-red-500 bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <AlertTitle className="font-bold text-red-800">
          انتهت الفترة التجريبية
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
          <span className="text-red-700">
            انتهت فترتك التجريبية. قم بالترقية للاستمرار في استخدام جميع الميزات.
          </span>
          <Button size="sm" className="bg-red-600 hover:bg-red-700">
            <Sparkles className="h-4 w-4 ml-2" />
            ترقية الآن
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // إذا كان مشترك بشكل فعال
  if (status === "active") {
    return (
      <Alert className="mb-6 border-green-500 bg-green-50">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertTitle className="font-bold text-green-800">
          اشتراك فعال
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
          <span className="text-green-700">
            اشتراكك فعال. استمتع بجميع ميزات المنصة!
          </span>
          <Badge variant="outline" className="border-green-500 text-green-700">
            {subscription?.plan_id || "خطة أساسية"}
          </Badge>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.tenant.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statsCards = [
    {
      title: "إجمالي المنتجات",
      value: stats?.productsCount || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/products",
    },
    {
      title: "إجمالي الطلبات",
      value: stats?.ordersCount || 0,
      icon: ShoppingCart,
      color: "text-green-600",
      bgColor: "bg-green-50",
      link: "/orders",
    },
    {
      title: "الحملات النشطة",
      value: stats?.campaignsCount || 0,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      link: "/campaigns",
    },
    {
      title: "إجمالي الإيرادات",
      value: `${((stats?.totalRevenue || 0) / 100).toFixed(2)} ر.س`,
      icon: DollarSign,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      link: "/orders",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على أداء متجرك</p>
      </div>

      {/* شريط حالة الاشتراك */}
      <SubscriptionBanner />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link key={index} href={stat.link}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الطلبات الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">لا توجد طلبات حتى الآن</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أداء الحملات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">لا توجد حملات نشطة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>البدء السريع</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/products">
              <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <h3 className="font-semibold mb-2">إضافة منتج</h3>
                <p className="text-sm text-muted-foreground">أضف منتجك الأول للبدء في البيع</p>
              </div>
            </Link>
            <Link href="/campaigns">
              <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <h3 className="font-semibold mb-2">إنشاء حملة</h3>
                <p className="text-sm text-muted-foreground">ابدأ حملتك التسويقية الأولى</p>
              </div>
            </Link>
            <Link href="/landing-pages">
              <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <h3 className="font-semibold mb-2">صفحة هبوط بالذكاء الاصطناعي</h3>
                <p className="text-sm text-muted-foreground">أنشئ صفحة هبوط احترافية تلقائياً</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
