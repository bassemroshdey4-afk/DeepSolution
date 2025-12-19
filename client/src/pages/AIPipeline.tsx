import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Target, FileText, Megaphone, ChevronRight, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AIPipeline() {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Get products list
  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery();

  // Run full pipeline mutation
  const runPipelineMutation = trpc.aiPipeline.runFullPipeline.useMutation({
    onSuccess: (data) => {
      setPipelineResult(data);
      setCurrentStep(4);
      toast.success("تم إكمال خط الأنابيب بنجاح!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRunPipeline = () => {
    if (!selectedProductId) {
      toast.error("يرجى اختيار منتج أولاً");
      return;
    }
    setCurrentStep(1);
    runPipelineMutation.mutate({ productId: selectedProductId, language });
  };

  const steps = [
    { icon: Target, label: "اختيار المنتج", description: "حدد المنتج للتحليل" },
    { icon: Sparkles, label: "ذكاء المنتج", description: "تحليل وفهم المنتج" },
    { icon: FileText, label: "صفحة الهبوط", description: "توليد محتوى الصفحة" },
    { icon: Megaphone, label: "إعلانات Meta", description: "إنشاء الحملة الإعلانية" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
          <Sparkles className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">خط أنابيب التسويق الذكي</h1>
          <p className="text-muted-foreground">من المنتج إلى الحملة الإعلانية في خطوة واحدة</p>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className={`flex items-center gap-2 ${currentStep > index ? 'text-green-600' : currentStep === index ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`p-2 rounded-full ${currentStep > index ? 'bg-green-100' : currentStep === index ? 'bg-primary/10' : 'bg-muted'}`}>
                {currentStep > index ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <div className="hidden md:block">
                <p className="font-medium text-sm">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="h-5 w-5 mx-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle>إعدادات الحملة</CardTitle>
            <CardDescription>اختر المنتج واللغة لبدء التوليد</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>المنتج</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر منتجاً..." />
                </SelectTrigger>
                <SelectContent>
                  {productsLoading ? (
                    <SelectItem value="loading" disabled>جاري التحميل...</SelectItem>
                  ) : products && products.length > 0 ? (
                    products.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {product.price} ر.س
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="empty" disabled>لا توجد منتجات</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>لغة المحتوى</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "ar" | "en")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRunPipeline}
              disabled={runPipelineMutation.isPending || !selectedProductId}
              className="w-full"
              size="lg"
            >
              {runPipelineMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Sparkles className="ml-2 h-4 w-4" />
                  تشغيل خط الأنابيب الكامل
                </>
              )}
            </Button>

            {runPipelineMutation.isPending && (
              <div className="text-center text-sm text-muted-foreground">
                <p>يتم الآن تحليل المنتج وتوليد المحتوى...</p>
                <p>قد يستغرق هذا 30-60 ثانية</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card>
          <CardHeader>
            <CardTitle>النتائج</CardTitle>
            <CardDescription>
              {pipelineResult ? `تم توليد المحتوى لـ "${pipelineResult.productName}"` : "ستظهر النتائج هنا"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineResult ? (
              <Tabs defaultValue="intelligence" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="intelligence">ذكاء المنتج</TabsTrigger>
                  <TabsTrigger value="landing">صفحة الهبوط</TabsTrigger>
                  <TabsTrigger value="ads">الإعلانات</TabsTrigger>
                </TabsList>
                
                <TabsContent value="intelligence" className="mt-4">
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">الفئة:</p>
                      <p>{pipelineResult.intelligence?.category}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">الجمهور المستهدف:</p>
                      <p>{pipelineResult.intelligence?.targetAudience?.demographics}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">نقاط البيع:</p>
                      <ul className="list-disc list-inside">
                        {pipelineResult.intelligence?.uniqueSellingPoints?.map((usp: string, i: number) => (
                          <li key={i}>{usp}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">الكلمات المفتاحية:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pipelineResult.intelligence?.keywords?.map((kw: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-primary/10 rounded text-xs">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="landing" className="mt-4">
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">العنوان الرئيسي:</p>
                      <p className="text-lg font-bold">{pipelineResult.landingPage?.headline}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">العنوان الفرعي:</p>
                      <p>{pipelineResult.landingPage?.subheadline}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">زر الإجراء:</p>
                      <Button size="sm" className="mt-1">{pipelineResult.landingPage?.ctaText}</Button>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">الفوائد:</p>
                      <ul className="list-disc list-inside">
                        {pipelineResult.landingPage?.benefits?.map((b: string, i: number) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ads" className="mt-4">
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">هدف الحملة:</p>
                      <p>{pipelineResult.metaAds?.campaignObjective}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">Hooks:</p>
                      <ul className="list-disc list-inside">
                        {pipelineResult.metaAds?.hooks?.slice(0, 3).map((h: string, i: number) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                    {pipelineResult.metaAds?.adCopies?.map((ad: any, i: number) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-medium">إعلان {i + 1}:</p>
                        <p className="font-bold">{ad.headline}</p>
                        <p className="text-muted-foreground">{ad.primaryText}</p>
                        <Button size="sm" variant="outline" className="mt-2">{ad.callToAction}</Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Sparkles className="h-12 w-12 mx-auto opacity-20" />
                  <p>اختر منتجاً واضغط "تشغيل خط الأنابيب"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token Usage */}
      {pipelineResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">إجمالي التوكنات المستخدمة:</span>
              <span className="font-mono">{pipelineResult.totalTokensUsed?.toLocaleString()}</span>
            </div>
            {pipelineResult.campaignId && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">معرف الحملة:</span>
                <span className="font-mono text-xs">{pipelineResult.campaignId}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
