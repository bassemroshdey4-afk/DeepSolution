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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, Sparkles, Eye, Trash2 } from "lucide-react";

export default function LandingPages() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    productName: "",
    productDescription: "",
  });

  const utils = trpc.useUtils();
  const { data: pages, isLoading } = trpc.landingPages.list.useQuery();

  const generateMutation = trpc.landingPages.generate.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء صفحة الهبوط بنجاح!");
      setIsDialogOpen(false);
      setFormData({ productName: "", productDescription: "" });
      utils.landingPages.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء صفحة الهبوط");
    },
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف صفحة الهبوط");
      utils.landingPages.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate({
      productName: formData.productName,
      productDescription: formData.productDescription,
    });
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
          <h1 className="text-3xl font-bold">صفحات الهبوط</h1>
          <p className="text-muted-foreground mt-2">إنشاء صفحات هبوط احترافية بالذكاء الاصطناعي</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Sparkles className="ml-2 h-5 w-5" />
              إنشاء بالذكاء الاصطناعي
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء صفحة هبوط بالذكاء الاصطناعي</DialogTitle>
              <DialogDescription>
                أدخل معلومات المنتج وسيقوم الذكاء الاصطناعي بإنشاء صفحة هبوط احترافية تلقائياً
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">اسم المنتج *</Label>
                <Input
                  id="productName"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  required
                  placeholder="مثال: ساعة ذكية رياضية"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productDescription">وصف المنتج *</Label>
                <Textarea
                  id="productDescription"
                  value={formData.productDescription}
                  onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                  required
                  placeholder="اكتب وصفاً تفصيلياً للمنتج، مميزاته، والجمهور المستهدف..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  كلما كان الوصف أكثر تفصيلاً، كانت صفحة الهبوط أفضل
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={generateMutation.isPending} className="flex-1">
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإنشاء بالذكاء الاصطناعي...
                    </>
                  ) : (
                    <>
                      <Sparkles className="ml-2 h-4 w-4" />
                      إنشاء صفحة الهبوط
                    </>
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

      {pages && pages.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{page.title}</CardTitle>
                    <Badge variant={page.status === "published" ? "default" : "secondary"}>
                      {page.status === "published" ? "منشورة" : "مسودة"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {typeof page.content === "object" && page.content !== null && "description" in page.content
                    ? (page.content as any).description
                    : ""}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">المشاهدات:</span>
                    <span className="font-semibold mr-2">{page.views}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">التحويلات:</span>
                    <span className="font-semibold mr-2">{page.conversions}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="ml-2 h-4 w-4" />
                    معاينة
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate({ id: page.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  تم الإنشاء: {new Date(page.createdAt).toLocaleDateString("ar-SA")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <Sparkles className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد صفحات هبوط</h3>
          <p className="text-muted-foreground mb-6">أنشئ صفحة هبوطك الأولى بالذكاء الاصطناعي</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Sparkles className="ml-2 h-5 w-5" />
            إنشاء بالذكاء الاصطناعي
          </Button>
        </div>
      )}
    </div>
  );
}
