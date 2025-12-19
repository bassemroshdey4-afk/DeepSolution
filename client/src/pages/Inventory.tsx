import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, History, Plus, Minus } from "lucide-react";

export default function Inventory() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"in" | "out" | "adjustment">("adjustment");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  // Queries
  const { data: stockLevels, isLoading: loadingStock, refetch: refetchStock } = 
    trpc.inventory.getStockLevels.useQuery({});
  const { data: lowStockAlerts } = trpc.inventory.getLowStockAlerts.useQuery();
  const { data: movements, isLoading: loadingMovements } = 
    trpc.inventory.getMovements.useQuery(
      { productId: selectedProductId || undefined },
      { enabled: !!selectedProductId }
    );

  // Mutations
  const adjustStockMutation = trpc.inventory.recordMovement.useMutation({
    onSuccess: () => {
      refetchStock();
      setAdjustmentOpen(false);
      setAdjustmentQty("");
      setAdjustmentReason("");
      alert("تم تعديل المخزون بنجاح");
    },
    onError: (err: any) => {
      alert("خطأ: " + err.message);
    },
  });

  const handleAdjustment = () => {
    if (!selectedProductId || !adjustmentQty) return;
    
    let qty = parseInt(adjustmentQty);
    if (adjustmentType === "out") {
      qty = -Math.abs(qty);
    } else if (adjustmentType === "in") {
      qty = Math.abs(qty);
    }

    adjustStockMutation.mutate({
      productId: selectedProductId,
      quantity: qty,
      type: adjustmentType,
      notes: adjustmentReason || undefined,
    });
  };

  const getStockStatus = (product: any) => {
    const available = (product.quantity || 0) - (product.reserved_stock || 0);
    const threshold = product.low_stock_threshold || 10;
    
    if (product.quantity === 0) {
      return { label: "نفد", variant: "destructive" as const };
    }
    if (product.quantity <= threshold) {
      return { label: "منخفض", variant: "warning" as const };
    }
    return { label: "متوفر", variant: "default" as const };
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">إدارة المخزون</h1>
          <p className="text-muted-foreground">مراقبة مستويات المخزون وحركاته</p>
        </div>
      </div>

      {/* Alerts */}
      {lowStockAlerts && lowStockAlerts.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-yellow-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              تنبيهات المخزون ({lowStockAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockAlerts.slice(0, 5).map((alert: any) => (
                <Badge 
                  key={alert.productId} 
                  variant={alert.severity === "critical" ? "destructive" : "outline"}
                >
                  {alert.productName}: {alert.currentStock} متبقي
                </Badge>
              ))}
              {lowStockAlerts.length > 5 && (
                <Badge variant="secondary">+{lowStockAlerts.length - 5} أخرى</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            مستويات المخزون
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            حركات المخزون
          </TabsTrigger>
        </TabsList>

        {/* Stock Levels Tab */}
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>مستويات المخزون</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStock ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : !stockLevels || stockLevels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد منتجات. أضف منتجات من صفحة المنتجات.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">الكمية الحالية</TableHead>
                      <TableHead className="text-center">محجوز</TableHead>
                      <TableHead className="text-center">متاح</TableHead>
                      <TableHead className="text-center">حد إعادة الطلب</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLevels.map((product: any) => {
                      const status = getStockStatus(product);
                      const available = (product.quantity || 0) - (product.reserved_stock || 0);
                      
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {product.sku || "-"}
                          </TableCell>
                          <TableCell className="text-center">{product.quantity || 0}</TableCell>
                          <TableCell className="text-center text-orange-600">
                            {product.reserved_stock || 0}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {available}
                          </TableCell>
                          <TableCell className="text-center">
                            {product.low_stock_threshold || 10}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={status.variant === "warning" ? "outline" : status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedProductId(product.id);
                                }}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Dialog open={adjustmentOpen && selectedProductId === product.id} onOpenChange={(open) => {
                                setAdjustmentOpen(open);
                                if (open) setSelectedProductId(product.id);
                              }}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    تعديل
                                  </Button>
                                </DialogTrigger>
                                <DialogContent dir="rtl">
                                  <DialogHeader>
                                    <DialogTitle>تعديل المخزون - {product.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>نوع التعديل</Label>
                                      <Select value={adjustmentType} onValueChange={(v: any) => setAdjustmentType(v)}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="in">
                                            <span className="flex items-center gap-2">
                                              <Plus className="h-4 w-4 text-green-600" />
                                              إضافة للمخزون
                                            </span>
                                          </SelectItem>
                                          <SelectItem value="out">
                                            <span className="flex items-center gap-2">
                                              <Minus className="h-4 w-4 text-red-600" />
                                              خصم من المخزون
                                            </span>
                                          </SelectItem>
                                          <SelectItem value="adjustment">
                                            تعديل (جرد)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>الكمية</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={adjustmentQty}
                                        onChange={(e) => setAdjustmentQty(e.target.value)}
                                        placeholder="أدخل الكمية"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>السبب (اختياري)</Label>
                                      <Input
                                        value={adjustmentReason}
                                        onChange={(e) => setAdjustmentReason(e.target.value)}
                                        placeholder="مثال: جرد، تلف، إرجاع..."
                                      />
                                    </div>
                                    <Button 
                                      onClick={handleAdjustment}
                                      disabled={!adjustmentQty || adjustStockMutation.isPending}
                                      className="w-full"
                                    >
                                      {adjustStockMutation.isPending ? "جاري التعديل..." : "تأكيد التعديل"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>حركات المخزون</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedProductId ? (
                <div className="text-center py-8 text-muted-foreground">
                  اختر منتجاً من تبويب "مستويات المخزون" لعرض حركاته
                </div>
              ) : loadingMovements ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : !movements || movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد حركات لهذا المنتج
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead>المرجع</TableHead>
                      <TableHead>السبب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement: any) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {new Date(movement.created_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={movement.quantity > 0 ? "default" : "destructive"}>
                            {movement.type === "in" && "إضافة"}
                            {movement.type === "out" && "خصم"}
                            {movement.type === "return" && "إرجاع"}
                            {movement.type === "adjustment" && "تعديل"}
                            {movement.type === "purchase" && "شراء"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          <span className={movement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                            {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.reference_type && `${movement.reference_type}: ${movement.reference_id?.slice(0, 8) || "-"}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.reason || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
