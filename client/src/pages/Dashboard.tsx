import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, DollarSign, Loader2 } from "lucide-react";

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
    },
    {
      title: "إجمالي الطلبات",
      value: stats?.ordersCount || 0,
      icon: ShoppingCart,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "الحملات النشطة",
      value: stats?.campaignsCount || 0,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "إجمالي الإيرادات",
      value: `${((stats?.totalRevenue || 0) / 100).toFixed(2)} ر.س`,
      icon: DollarSign,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على أداء متجرك</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
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
            <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <h3 className="font-semibold mb-2">إضافة منتج</h3>
              <p className="text-sm text-muted-foreground">أضف منتجك الأول للبدء في البيع</p>
            </div>
            <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <h3 className="font-semibold mb-2">إنشاء حملة</h3>
              <p className="text-sm text-muted-foreground">ابدأ حملتك التسويقية الأولى</p>
            </div>
            <div className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <h3 className="font-semibold mb-2">صفحة هبوط بالذكاء الاصطناعي</h3>
              <p className="text-sm text-muted-foreground">أنشئ صفحة هبوط احترافية تلقائياً</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
