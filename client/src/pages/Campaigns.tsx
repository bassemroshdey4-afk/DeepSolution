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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, TrendingUp, DollarSign, Target, RefreshCw } from "lucide-react";

const platformLabels = {
  facebook: "فيسبوك",
  google: "جوجل",
  tiktok: "تيك توك",
  snapchat: "سناب شات",
  instagram: "إنستغرام",
  other: "أخرى",
};

export default function Campaigns() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    platform: "facebook" as keyof typeof platformLabels,
    budget: "",
    startDate: "",
  });

  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();

  const createCampaignMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الحملة بنجاح");
      setIsDialogOpen(false);
      setFormData({ name: "", description: "", platform: "facebook", budget: "", startDate: "" });
      utils.campaigns.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء الحملة");
    },
  });

  const calculateROASMutation = trpc.campaigns.calculateROAS.useMutation({
    onSuccess: (data: { roas: number }) => {
      toast.success(`تم حساب ROAS: ${data.roas}%`);
      utils.campaigns.list.invalidate();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "حدث خطأ أثناء حساب ROAS");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaignMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      platform: formData.platform,
      budget: Math.round(parseFloat(formData.budget) * 100),
      start_date: formData.startDate || undefined,
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
          <h1 className="text-3xl font-bold">الحملات التسويقية</h1>
          <p className="text-muted-foreground mt-2">إدارة وتتبع حملاتك الإعلانية</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="ml-2 h-5 w-5" />
              حملة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء حملة تسويقية جديدة</DialogTitle>
              <DialogDescription>أدخل معلومات الحملة الإعلانية</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الحملة *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="مثال: حملة الصيف 2024"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف الحملة وأهدافها"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">المنصة *</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value) => setFormData({ ...formData, platform: value as any })}
                  >
                    <SelectTrigger id="platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(platformLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">الميزانية (ر.س) *</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">تاريخ البدء *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createCampaignMutation.isPending} className="flex-1">
                  {createCampaignMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    "إنشاء الحملة"
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

      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{campaign.name}</CardTitle>
                    <Badge variant="outline">{platformLabels[campaign.platform as keyof typeof platformLabels] || campaign.platform}</Badge>
                  </div>
                  <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                    {campaign.status === "active" ? "نشطة" : campaign.status === "paused" ? "متوقفة" : "مكتملة"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      الميزانية
                    </div>
                    <div className="text-lg font-semibold">{(campaign.budget / 100).toFixed(2)} ر.س</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="h-4 w-4" />
                      المصروف
                    </div>
                    <div className="text-lg font-semibold">{(campaign.spent / 100).toFixed(2)} ر.س</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    الإيرادات
                  </div>
                  <div className="text-lg font-semibold">{(campaign.revenue / 100).toFixed(2)} ر.س</div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">ROAS (العائد على الإنفاق)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => calculateROASMutation.mutate({ id: campaign.id })}
                      disabled={calculateROASMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-2xl font-bold text-primary">{campaign.roas}%</div>
                </div>

                <div className="text-xs text-muted-foreground">
                  بدأت في: {new Date(campaign.startDate).toLocaleDateString("ar-SA")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد حملات</h3>
          <p className="text-muted-foreground mb-6">ابدأ حملتك التسويقية الأولى</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="ml-2 h-5 w-5" />
            حملة جديدة
          </Button>
        </div>
      )}
    </div>
  );
}
