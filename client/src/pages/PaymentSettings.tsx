import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  CreditCard, 
  Wallet, 
  Building2, 
  Smartphone, 
  Plus, 
  Settings, 
  Trash2, 
  Edit,
  Star,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";

// Payment provider configurations
const PAYMENT_PROVIDERS = [
  { 
    id: "stripe", 
    name: "Stripe", 
    name_ar: "سترايب",
    icon: CreditCard, 
    description: "بطاقات ائتمان وخصم عالمية",
    supported_currencies: ["USD", "EUR", "GBP", "SAR", "AED", "EGP"]
  },
  { 
    id: "paypal", 
    name: "PayPal", 
    name_ar: "باي بال",
    icon: Wallet, 
    description: "محفظة إلكترونية عالمية",
    supported_currencies: ["USD", "EUR", "GBP"]
  },
  { 
    id: "tap", 
    name: "Tap Payments", 
    name_ar: "تاب للمدفوعات",
    icon: CreditCard, 
    description: "بوابة دفع للشرق الأوسط",
    supported_currencies: ["SAR", "AED", "KWD", "BHD", "OMR", "QAR"]
  },
  { 
    id: "moyasar", 
    name: "Moyasar", 
    name_ar: "ميسر",
    icon: CreditCard, 
    description: "بوابة دفع سعودية",
    supported_currencies: ["SAR"]
  },
  { 
    id: "paymob", 
    name: "Paymob", 
    name_ar: "باي موب",
    icon: CreditCard, 
    description: "بوابة دفع مصرية",
    supported_currencies: ["EGP"]
  },
  { 
    id: "vodafone_cash", 
    name: "Vodafone Cash", 
    name_ar: "فودافون كاش",
    icon: Smartphone, 
    description: "دفع يدوي عبر المحفظة الإلكترونية",
    supported_currencies: ["EGP"]
  },
  { 
    id: "instapay", 
    name: "InstaPay", 
    name_ar: "انستاباي",
    icon: Smartphone, 
    description: "تحويل بنكي فوري",
    supported_currencies: ["EGP"]
  },
  { 
    id: "bank_transfer", 
    name: "Bank Transfer", 
    name_ar: "تحويل بنكي",
    icon: Building2, 
    description: "تحويل بنكي يدوي",
    supported_currencies: ["USD", "EUR", "SAR", "AED", "EGP"]
  },
  { 
    id: "cod", 
    name: "Cash on Delivery", 
    name_ar: "الدفع عند الاستلام",
    icon: Wallet, 
    description: "الدفع نقداً عند التسليم",
    supported_currencies: ["USD", "SAR", "AED", "EGP"]
  },
];

export default function PaymentSettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  
  // Form state for new payment method
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    description: "",
    description_ar: "",
    is_enabled: false,
    fee_type: "percentage" as "percentage" | "fixed" | "mixed",
    fee_percentage: 0,
    fee_fixed: 0,
    min_amount: 0,
    max_amount: 0,
  });

  const utils = trpc.useUtils();
  
  // Queries
  const { data: paymentMethods, isLoading } = trpc.paymentMethods.list.useQuery();
  
  // Mutations
  const createMethod = trpc.paymentMethods.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة طريقة الدفع بنجاح");
      utils.paymentMethods.list.invalidate();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إضافة طريقة الدفع");
    },
  });

  const updateMethod = trpc.paymentMethods.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث طريقة الدفع بنجاح");
      utils.paymentMethods.list.invalidate();
      setIsEditDialogOpen(false);
      setSelectedMethod(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء تحديث طريقة الدفع");
    },
  });

  const deleteMethod = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف طريقة الدفع بنجاح");
      utils.paymentMethods.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء حذف طريقة الدفع");
    },
  });

  const toggleMethod = trpc.paymentMethods.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.paymentMethods.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء تغيير حالة طريقة الدفع");
    },
  });

  const setDefaultMethod = trpc.paymentMethods.setDefault.useMutation({
    onSuccess: () => {
      toast.success("تم تعيين طريقة الدفع الافتراضية");
      utils.paymentMethods.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء تعيين طريقة الدفع الافتراضية");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      name_ar: "",
      description: "",
      description_ar: "",
      is_enabled: false,
      fee_type: "percentage",
      fee_percentage: 0,
      fee_fixed: 0,
      min_amount: 0,
      max_amount: 0,
    });
    setSelectedProvider("");
  };

  const handleProviderSelect = (providerId: string) => {
    const provider = PAYMENT_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(providerId);
      setFormData(prev => ({
        ...prev,
        name: provider.name,
        name_ar: provider.name_ar,
        description: provider.description,
        description_ar: provider.description,
      }));
    }
  };

  const handleCreateMethod = () => {
    if (!selectedProvider) {
      toast.error("يرجى اختيار مزود الدفع");
      return;
    }
    
    const provider = PAYMENT_PROVIDERS.find(p => p.id === selectedProvider);
    
    createMethod.mutate({
      provider: selectedProvider,
      name: formData.name,
      name_ar: formData.name_ar,
      description: formData.description,
      description_ar: formData.description_ar,
      is_enabled: formData.is_enabled,
      fee_type: formData.fee_type,
      fee_percentage: formData.fee_percentage,
      fee_fixed: formData.fee_fixed,
      min_amount: formData.min_amount,
      max_amount: formData.max_amount || undefined,
      supported_currencies: provider?.supported_currencies,
    });
  };

  const handleUpdateMethod = () => {
    if (!selectedMethod) return;
    
    updateMethod.mutate({
      id: selectedMethod.id,
      name: formData.name,
      name_ar: formData.name_ar,
      description: formData.description,
      description_ar: formData.description_ar,
      is_enabled: formData.is_enabled,
      fee_type: formData.fee_type,
      fee_percentage: formData.fee_percentage,
      fee_fixed: formData.fee_fixed,
      min_amount: formData.min_amount,
      max_amount: formData.max_amount || undefined,
    });
  };

  const openEditDialog = (method: any) => {
    setSelectedMethod(method);
    setFormData({
      name: method.name || "",
      name_ar: method.name_ar || "",
      description: method.description || "",
      description_ar: method.description_ar || "",
      is_enabled: method.is_enabled || false,
      fee_type: method.fee_type || "percentage",
      fee_percentage: method.fee_percentage || 0,
      fee_fixed: method.fee_fixed || 0,
      min_amount: method.min_amount || 0,
      max_amount: method.max_amount || 0,
    });
    setIsEditDialogOpen(true);
  };

  const getProviderIcon = (providerId: string) => {
    const provider = PAYMENT_PROVIDERS.find(p => p.id === providerId);
    const Icon = provider?.icon || CreditCard;
    return <Icon className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إعدادات الدفع</h1>
          <p className="text-muted-foreground">إدارة طرق الدفع المتاحة لعملائك</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              إضافة طريقة دفع
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة طريقة دفع جديدة</DialogTitle>
              <DialogDescription>
                اختر مزود الدفع وقم بتكوين الإعدادات
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="provider" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="provider">اختيار المزود</TabsTrigger>
                <TabsTrigger value="settings" disabled={!selectedProvider}>الإعدادات</TabsTrigger>
              </TabsList>
              
              <TabsContent value="provider" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PAYMENT_PROVIDERS.map((provider) => {
                    const Icon = provider.icon;
                    const isSelected = selectedProvider === provider.id;
                    return (
                      <Card 
                        key={provider.id}
                        className={`cursor-pointer transition-all hover:border-primary ${
                          isSelected ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => handleProviderSelect(provider.id)}
                      >
                        <CardContent className="p-4 text-center">
                          <Icon className={`h-8 w-8 mx-auto mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <p className="font-medium text-sm">{provider.name_ar}</p>
                          <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم (إنجليزي)</Label>
                    <Input 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Payment Method Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم (عربي)</Label>
                    <Input 
                      value={formData.name_ar}
                      onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                      placeholder="اسم طريقة الدفع"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف طريقة الدفع"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>نوع الرسوم</Label>
                    <Select 
                      value={formData.fee_type}
                      onValueChange={(value: "percentage" | "fixed" | "mixed") => 
                        setFormData(prev => ({ ...prev, fee_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة مئوية</SelectItem>
                        <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                        <SelectItem value="mixed">مختلط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {(formData.fee_type === "percentage" || formData.fee_type === "mixed") && (
                    <div className="space-y-2">
                      <Label>نسبة الرسوم (%)</Label>
                      <Input 
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.fee_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, fee_percentage: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  )}
                  
                  {(formData.fee_type === "fixed" || formData.fee_type === "mixed") && (
                    <div className="space-y-2">
                      <Label>رسوم ثابتة</Label>
                      <Input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.fee_fixed}
                        onChange={(e) => setFormData(prev => ({ ...prev, fee_fixed: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للمبلغ</Label>
                    <Input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.min_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_amount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأقصى للمبلغ (اختياري)</Label>
                    <Input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.max_amount || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="بدون حد"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>تفعيل طريقة الدفع</Label>
                    <p className="text-sm text-muted-foreground">اجعل طريقة الدفع متاحة للعملاء</p>
                  </div>
                  <Switch 
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                إلغاء
              </Button>
              <Button 
                onClick={handleCreateMethod}
                disabled={!selectedProvider || createMethod.isPending}
              >
                {createMethod.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  "إضافة طريقة الدفع"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Methods List */}
      {paymentMethods && paymentMethods.length > 0 ? (
        <div className="grid gap-4">
          {paymentMethods.map((method: any) => (
            <Card key={method.id} className={method.is_enabled ? "" : "opacity-60"}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${method.is_enabled ? "bg-primary/10" : "bg-muted"}`}>
                      {getProviderIcon(method.provider)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{method.name_ar || method.name}</h3>
                        {method.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" />
                            افتراضي
                          </Badge>
                        )}
                        {method.is_enabled ? (
                          <Badge variant="default" className="gap-1 bg-green-500">
                            <CheckCircle2 className="h-3 w-3" />
                            مفعّل
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            معطّل
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{method.description_ar || method.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {method.fee_percentage > 0 && (
                          <span>رسوم: {method.fee_percentage}%</span>
                        )}
                        {method.fee_fixed > 0 && (
                          <span>+ {method.fee_fixed} ثابت</span>
                        )}
                        {method.min_amount > 0 && (
                          <span>الحد الأدنى: {method.min_amount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={method.is_enabled}
                      onCheckedChange={(checked) => toggleMethod.mutate({ id: method.id, is_enabled: checked })}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(method)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setDefaultMethod.mutate({ id: method.id })}
                      disabled={method.is_default}
                    >
                      <Star className={`h-4 w-4 ${method.is_default ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("هل أنت متأكد من حذف طريقة الدفع هذه؟")) {
                          deleteMethod.mutate({ id: method.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد طرق دفع</h3>
            <p className="text-muted-foreground mb-4">
              أضف طرق الدفع لتمكين عملائك من الدفع
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة طريقة دفع
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل طريقة الدفع</DialogTitle>
            <DialogDescription>
              قم بتحديث إعدادات طريقة الدفع
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم (إنجليزي)</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم (عربي)</Label>
                <Input 
                  value={formData.name_ar}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea 
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>نوع الرسوم</Label>
                <Select 
                  value={formData.fee_type}
                  onValueChange={(value: "percentage" | "fixed" | "mixed") => 
                    setFormData(prev => ({ ...prev, fee_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                    <SelectItem value="mixed">مختلط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>نسبة الرسوم (%)</Label>
                <Input 
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.fee_percentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, fee_percentage: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>رسوم ثابتة</Label>
                <Input 
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.fee_fixed}
                  onChange={(e) => setFormData(prev => ({ ...prev, fee_fixed: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>تفعيل طريقة الدفع</Label>
                <p className="text-sm text-muted-foreground">اجعل طريقة الدفع متاحة للعملاء</p>
              </div>
              <Switch 
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleUpdateMethod}
              disabled={updateMethod.isPending}
            >
              {updateMethod.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "حفظ التغييرات"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
