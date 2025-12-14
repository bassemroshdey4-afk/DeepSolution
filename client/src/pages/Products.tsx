import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, Edit, Trash2, Package } from "lucide-react";

export default function Products() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    cost: "",
    sku: "",
    stock: "",
  });

  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.products.list.useQuery();

  const createProductMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المنتج بنجاح");
      setIsDialogOpen(false);
      setFormData({ name: "", description: "", price: "", cost: "", sku: "", stock: "" });
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إضافة المنتج");
    },
  });

  const deleteProductMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المنتج بنجاح");
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء حذف المنتج");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      price: Math.round(parseFloat(formData.price) * 100), // تحويل إلى قروش
      cost: formData.cost ? Math.round(parseFloat(formData.cost) * 100) : undefined,
      sku: formData.sku || undefined,
      stock: formData.stock ? parseInt(formData.stock) : 0,
      status: "active",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      deleteProductMutation.mutate({ id });
    }
  };

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
          <h1 className="text-3xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground mt-2">إدارة منتجات متجرك</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="ml-2 h-5 w-5" />
              إضافة منتج
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة منتج جديد</DialogTitle>
              <DialogDescription>أدخل معلومات المنتج الجديد</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المنتج *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="مثال: هاتف ذكي"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي للمنتج"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">السعر (ر.س) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">التكلفة (ر.س)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">رمز المنتج (SKU)</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="SKU-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">الكمية المتاحة</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createProductMutation.isPending} className="flex-1">
                  {createProductMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    "إضافة المنتج"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products && products.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      {product.sku && <div className="text-sm text-muted-foreground">{product.sku}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{(product.price / 100).toFixed(2)} ر.س</TableCell>
                  <TableCell>
                    <Badge variant={product.stock > 0 ? "default" : "destructive"}>{product.stock}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === "active" ? "default" : "secondary"}>
                      {product.status === "active" ? "نشط" : product.status === "draft" ? "مسودة" : "مؤرشف"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteProductMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد منتجات</h3>
          <p className="text-muted-foreground mb-6">ابدأ بإضافة منتجك الأول</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="ml-2 h-5 w-5" />
            إضافة منتج
          </Button>
        </div>
      )}
    </div>
  );
}
