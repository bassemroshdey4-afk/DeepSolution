import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function ProfitAnalytics() {
  const [activeTab, setActiveTab] = useState("orders");

  // Queries
  const ordersPnL = trpc.profit.listOrdersPnL.useQuery({ limit: 50 });
  const productSnapshots = trpc.profit.listProductSnapshots.useQuery();
  const codCashflow = trpc.profit.getCodCashflow.useQuery();

  // Mutations
  const batchRecompute = trpc.profit.batchRecompute.useMutation({
    onSuccess: () => {
      ordersPnL.refetch();
      productSnapshots.refetch();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "profit":
        return <Badge className="bg-green-500">ربح</Badge>;
      case "loss":
        return <Badge className="bg-red-500">خسارة</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">معلق</Badge>;
      default:
        return <Badge className="bg-gray-500">تعادل</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(value);
  };

  // Calculate summary
  const summary = {
    totalRevenue: (ordersPnL.data || []).reduce((sum, o: any) => sum + Number(o.revenue || 0), 0),
    totalCost: (ordersPnL.data || []).reduce((sum, o: any) => sum + Number(o.total_cost || 0), 0),
    totalProfit: (ordersPnL.data || []).reduce((sum, o: any) => sum + Number(o.net_profit || 0), 0),
    profitOrders: (ordersPnL.data || []).filter((o: any) => o.status === "profit").length,
    lossOrders: (ordersPnL.data || []).filter((o: any) => o.status === "loss").length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">تحليلات الربحية</h1>
            <p className="text-muted-foreground">
              تتبع الربح والخسارة لكل طلب ومنتج
            </p>
          </div>
          <Button
            onClick={() => batchRecompute.mutate({ all: true })}
            disabled={batchRecompute.isPending}
          >
            {batchRecompute.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <RefreshCw className="h-4 w-4 ml-2" />
            )}
            إعادة حساب الكل
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي التكاليف</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">صافي الربح</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(summary.totalProfit)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">نسبة الربح/الخسارة</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-green-600">{summary.profitOrders}</span>
                {" / "}
                <span className="text-red-600">{summary.lossOrders}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COD Cashflow */}
        {codCashflow.data && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                تدفق COD النقدي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">مبالغ معلقة</p>
                  <p className="text-xl font-bold text-yellow-600">
                    {formatCurrency(codCashflow.data.pendingAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مبالغ محصلة</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(codCashflow.data.collectedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">طلبات معلقة</p>
                  <p className="text-xl font-bold">{codCashflow.data.pendingOrdersCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">متوسط أيام التحصيل</p>
                  <p className="text-xl font-bold">{codCashflow.data.avgSettlementDays} يوم</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
            <TabsTrigger value="products">المنتجات</TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>ربحية الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersPnL.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (ordersPnL.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد بيانات P&L - قم بإعادة حساب الطلبات
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-2">رقم الطلب</th>
                          <th className="text-right py-2">الإيرادات</th>
                          <th className="text-right py-2">التكاليف</th>
                          <th className="text-right py-2">صافي الربح</th>
                          <th className="text-right py-2">الهامش</th>
                          <th className="text-right py-2">الحالة</th>
                          <th className="text-right py-2">أسباب الخسارة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ordersPnL.data || []).map((pnl: any) => (
                          <tr key={pnl.order_id} className="border-b hover:bg-muted/50">
                            <td className="py-2">{pnl.orders?.order_number || pnl.order_id.slice(0, 8)}</td>
                            <td className="py-2">{formatCurrency(pnl.revenue)}</td>
                            <td className="py-2 text-red-600">{formatCurrency(pnl.total_cost)}</td>
                            <td className={`py-2 font-medium ${pnl.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(pnl.net_profit)}
                            </td>
                            <td className="py-2">{pnl.margin?.toFixed(1)}%</td>
                            <td className="py-2">{getStatusBadge(pnl.status)}</td>
                            <td className="py-2 text-sm text-muted-foreground">
                              {(pnl.loss_reasons || []).join(", ") || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>ربحية المنتجات</CardTitle>
              </CardHeader>
              <CardContent>
                {productSnapshots.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (productSnapshots.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد بيانات منتجات
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-2">المنتج</th>
                          <th className="text-right py-2">الطلبات</th>
                          <th className="text-right py-2">الإيرادات</th>
                          <th className="text-right py-2">صافي الربح</th>
                          <th className="text-right py-2">متوسط الربح</th>
                          <th className="text-right py-2">نسبة الإرجاع</th>
                          <th className="text-right py-2">السعر الأدنى</th>
                          <th className="text-right py-2">التوصية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(productSnapshots.data || []).map((item: any) => (
                          <tr key={item.product.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 font-medium">{item.product.name}</td>
                            <td className="py-2">{item.snapshot.ordersCount}</td>
                            <td className="py-2">{formatCurrency(item.snapshot.revenue)}</td>
                            <td className={`py-2 font-medium ${item.snapshot.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(item.snapshot.netProfit)}
                            </td>
                            <td className="py-2">{formatCurrency(item.snapshot.avgProfitPerOrder)}</td>
                            <td className="py-2">
                              <span className={item.snapshot.returnRate > 10 ? "text-red-600" : ""}>
                                {item.snapshot.returnRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="text-xs">
                                <div>تعادل: {formatCurrency(item.priceInsight.breakEvenPrice)}</div>
                                <div>10%: {formatCurrency(item.priceInsight.minPrice10)}</div>
                                <div>20%: {formatCurrency(item.priceInsight.minPrice20)}</div>
                              </div>
                            </td>
                            <td className="py-2 text-sm max-w-[200px]">
                              {item.priceInsight.recommendation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
