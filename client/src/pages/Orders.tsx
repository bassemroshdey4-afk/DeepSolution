import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Phone } from "lucide-react";

const statusLabels = {
  new: "جديد",
  confirmed: "مؤكد",
  processing: "قيد المعالجة",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

const callCenterStatusLabels = {
  pending: "قيد الانتظار",
  contacted: "تم الاتصال",
  callback: "إعادة الاتصال",
  no_answer: "لا يرد",
  confirmed: "مؤكد",
};

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  confirmed: "default",
  processing: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
};

export default function Orders() {
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.orders.list.useQuery();

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب");
      utils.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء تحديث الحالة");
    },
  });

  const updateCallCenterStatusMutation = trpc.orders.updateCallCenterStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة مركز الاتصال");
      utils.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء تحديث الحالة");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الطلبات</h1>
          <p className="text-muted-foreground mt-2">إدارة ومتابعة الطلبات</p>
        </div>
        <Button size="lg">
          <ShoppingCart className="ml-2 h-5 w-5" />
          طلب جديد
        </Button>
      </div>

      {orders && orders.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>مركز الاتصال</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {order.customerPhone}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{(order.totalAmount / 100).toFixed(2)} ر.س</TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(value) =>
                        updateStatusMutation.mutate({
                          id: order.id,
                          status: value as any,
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.callCenterStatus}
                      onValueChange={(value) =>
                        updateCallCenterStatusMutation.mutate({
                          id: order.id,
                          callCenterStatus: value as any,
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(callCenterStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("ar-SA")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد طلبات</h3>
          <p className="text-muted-foreground mb-6">ستظهر الطلبات هنا عند إضافتها</p>
          <Button>
            <ShoppingCart className="ml-2 h-5 w-5" />
            إضافة طلب
          </Button>
        </div>
      )}
    </div>
  );
}
