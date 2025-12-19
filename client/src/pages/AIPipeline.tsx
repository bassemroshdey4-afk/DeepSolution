import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Target, FileText, Megaphone, ChevronRight, CheckCircle2, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type StepStatus = "pending" | "running" | "done" | "error";

interface PipelineStep {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  status: StepStatus;
  fromCache?: boolean;
  version?: number;
}

export default function AIPipeline() {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: "select", icon: Target, label: "اختيار المنتج", description: "حدد المنتج للتحليل", status: "pending" },
    { id: "intelligence", icon: Sparkles, label: "ذكاء المنتج", description: "تحليل وفهم المنتج", status: "pending" },
    { id: "landing", icon: FileText, label: "صفحة الهبوط", description: "توليد محتوى الصفحة", status: "pending" },
    { id: "ads", icon: Megaphone, label: "إعلانات Meta", description: "إنشاء الحملة الإعلانية", status: "pending" },
  ]);

  // Get products list
  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery();

  // Get usage stats
  const { data: usageStats } = trpc.aiPipeline.getUsageStats.useQuery();

  // Individual stage mutations for retry functionality
  const analyzeProductMutation = trpc.aiPipeline.analyzeProduct.useMutation();
  const generateLandingMutation = trpc.aiPipeline.generateLandingPage.useMutation();
  const generateAdsMutation = trpc.aiPipeline.generateMetaAds.useMutation();

  // Run full pipeline mutation
  const runPipelineMutation = trpc.aiPipeline.runFullPipeline.useMutation({
    onMutate: () => {
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === 0 ? "done" : i === 1 ? "running" : "pending"
      })));
    },
    onSuccess: (data) => {
      setPipelineResult(data);
      setSteps(prev => prev.map(s => ({
        ...s,
        status: "done",
        fromCache: s.id === "intelligence" ? data.intelligence.fromCache :
                  s.id === "landing" ? data.landingPage.fromCache :
                  s.id === "ads" ? data.metaAds.fromCache : undefined,
        version: s.id === "intelligence" ? data.intelligence.version :
                 s.id === "landing" ? data.landingPage.version :
                 s.id === "ads" ? data.metaAds.version : undefined,
      })));
      toast.success("تم إكمال خط الأنابيب بنجاح!");
    },
    onError: (error) => {
      const errorStep = steps.findIndex(s => s.status === "running");
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === errorStep ? "error" : s.status === "running" ? "pending" : s.status
      })));
      toast.error(error.message);
    },
  });

  const handleRunPipeline = () => {
    if (!selectedProductId) {
      toast.error("يرجى اختيار منتج أولاً");
      return;
    }
    
    // Reset steps
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      status: i === 0 ? "done" : "pending",
      fromCache: undefined,
      version: undefined,
    })));
    setPipelineResult(null);
    
    runPipelineMutation.mutate({ 
      productId: selectedProductId, 
      language,
      forceRegenerate 
    });
  };

  const handleRetryStep = async (stepId: string) => {
    if (!selectedProductId) return;

    const stepIndex = steps.findIndex(s => s.id === stepId);
    setSteps(prev => prev.map((s, i) => ({
      ...s,
      status: i === stepIndex ? "running" : s.status
    })));

    try {
      if (stepId === "intelligence") {
        const result = await analyzeProductMutation.mutateAsync({
          productId: selectedProductId,
          language,
          forceRegenerate: true,
        });
        setPipelineResult((prev: any) => prev ? { ...prev, intelligence: { data: result.intelligence, version: result.version, fromCache: false } } : null);
      } else if (stepId === "landing") {
        const result = await generateLandingMutation.mutateAsync({
          productId: selectedProductId,
          language,
          forceRegenerate: true,
        });
        setPipelineResult((prev: any) => prev ? { ...prev, landingPage: { data: result.content, version: result.version, fromCache: false } } : null);
      } else if (stepId === "ads") {
        const result = await generateAdsMutation.mutateAsync({
          productId: selectedProductId,
          language,
          forceRegenerate: true,
        });
        setPipelineResult((prev: any) => prev ? { ...prev, metaAds: { data: result.content, version: result.version, fromCache: false } } : null);
      }
      
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === stepIndex ? "done" : s.status,
        fromCache: i === stepIndex ? false : s.fromCache,
      })));
      toast.success("تم إعادة التوليد بنجاح!");
    } catch (error: any) {
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === stepIndex ? "error" : s.status
      })));
      toast.error(error.message);
    }
  };

  const getStepStatusIcon = (status: StepStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStepBgColor = (status: StepStatus) => {
    switch (status) {
      case "done":
        return "bg-green-100";
      case "running":
        return "bg-primary/10";
      case "error":
        return "bg-destructive/10";
      default:
        return "bg-muted";
    }
  };

  // Calculate remaining usage
  const getRemainingUsage = (slug: string) => {
    const sub = usageStats?.subscriptions?.find((s: any) => s.ai_addons?.slug === slug);
    return sub?.usage_remaining ?? 0;
  };

  const hasEnoughUsage = () => {
    return (
      getRemainingUsage("product-intelligence") > 0 &&
      getRemainingUsage("landing-page-generator") > 0 &&
      getRemainingUsage("meta-ads-generator") > 0
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
            <Sparkles className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">خط أنابيب التسويق الذكي</h1>
            <p className="text-muted-foreground">من المنتج إلى الحملة الإعلانية في خطوة واحدة</p>
          </div>
        </div>
        
        {/* Usage Stats */}
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            ذكاء: {getRemainingUsage("product-intelligence")}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            صفحات: {getRemainingUsage("landing-page-generator")}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Megaphone className="h-3 w-3" />
            إعلانات: {getRemainingUsage("meta-ads-generator")}
          </Badge>
        </div>
      </div>

      {/* Usage Warning */}
      {!hasEnoughUsage() && usageStats && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>رصيد غير كافٍ</AlertTitle>
          <AlertDescription>
            يجب تفعيل جميع إضافات AI (ذكاء المنتج، صفحات الهبوط، إعلانات Meta) لتشغيل خط الأنابيب.
            <Button variant="link" className="p-0 h-auto mr-2" onClick={() => window.location.href = "/ai-addons"}>
              تفعيل الإضافات
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Steps Progress */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 ${
              step.status === "done" ? "text-green-600" : 
              step.status === "running" ? "text-primary" : 
              step.status === "error" ? "text-destructive" : 
              "text-muted-foreground"
            }`}>
              <div className={`p-2 rounded-full ${getStepBgColor(step.status)}`}>
                {getStepStatusIcon(step.status) || <step.icon className="h-5 w-5" />}
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{step.label}</p>
                  {step.fromCache && <Badge variant="secondary" className="text-xs">من الذاكرة</Badge>}
                  {step.version && <Badge variant="outline" className="text-xs">v{step.version}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {step.status === "error" && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRetryStep(step.id)}
                  disabled={analyzeProductMutation.isPending || generateLandingMutation.isPending || generateAdsMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="h-5 w-5 mx-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات خط الأنابيب</CardTitle>
          <CardDescription>اختر المنتج واللغة لبدء التحليل والتوليد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>المنتج</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder={productsLoading ? "جاري التحميل..." : "اختر منتجاً"} />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product: any) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {product.price} ر.س
                    </SelectItem>
                  ))}
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

            <div className="space-y-2">
              <Label>خيارات</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch 
                  id="force-regenerate" 
                  checked={forceRegenerate}
                  onCheckedChange={setForceRegenerate}
                />
                <Label htmlFor="force-regenerate" className="text-sm font-normal">
                  إعادة التوليد (تجاهل الذاكرة)
                </Label>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleRunPipeline} 
            disabled={!selectedProductId || runPipelineMutation.isPending || !hasEnoughUsage()}
            className="w-full"
          >
            {runPipelineMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التنفيذ...
              </>
            ) : (
              <>
                <Sparkles className="ml-2 h-4 w-4" />
                تشغيل خط الأنابيب الكامل
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {pipelineResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              نتائج خط الأنابيب - {pipelineResult.productName}
            </CardTitle>
            <CardDescription>
              إجمالي التوكنات المستخدمة: {pipelineResult.totalTokensUsed}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="intelligence">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="intelligence">
                  ذكاء المنتج
                  {pipelineResult.intelligence.fromCache && <Badge variant="secondary" className="mr-2 text-xs">ذاكرة</Badge>}
                </TabsTrigger>
                <TabsTrigger value="landing">
                  صفحة الهبوط
                  {pipelineResult.landingPage.fromCache && <Badge variant="secondary" className="mr-2 text-xs">ذاكرة</Badge>}
                </TabsTrigger>
                <TabsTrigger value="ads">
                  إعلانات Meta
                  {pipelineResult.metaAds.fromCache && <Badge variant="secondary" className="mr-2 text-xs">ذاكرة</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="intelligence" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">ذكاء المنتج (الإصدار {pipelineResult.intelligence.version})</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRetryStep("intelligence")}
                    disabled={analyzeProductMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ml-2 ${analyzeProductMutation.isPending ? 'animate-spin' : ''}`} />
                    إعادة التحليل
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-96" dir="ltr">
                  {JSON.stringify(pipelineResult.intelligence.data, null, 2)}
                </pre>
              </TabsContent>

              <TabsContent value="landing" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">محتوى صفحة الهبوط (الإصدار {pipelineResult.landingPage.version})</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRetryStep("landing")}
                    disabled={generateLandingMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ml-2 ${generateLandingMutation.isPending ? 'animate-spin' : ''}`} />
                    إعادة التوليد
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-96" dir="ltr">
                  {JSON.stringify(pipelineResult.landingPage.data, null, 2)}
                </pre>
              </TabsContent>

              <TabsContent value="ads" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">حملة Meta الإعلانية (الإصدار {pipelineResult.metaAds.version})</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRetryStep("ads")}
                    disabled={generateAdsMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ml-2 ${generateAdsMutation.isPending ? 'animate-spin' : ''}`} />
                    إعادة التوليد
                  </Button>
                </div>
                {pipelineResult.metaAds.campaignId && (
                  <p className="text-sm text-muted-foreground mb-2">
                    تم حفظ الحملة في قاعدة البيانات (ID: {pipelineResult.metaAds.campaignId})
                  </p>
                )}
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-96" dir="ltr">
                  {JSON.stringify(pipelineResult.metaAds.data, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!pipelineResult && !runPipelineMutation.isPending && products?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد منتجات</h3>
            <p className="text-muted-foreground mb-4">أضف منتجاً أولاً لتشغيل خط الأنابيب</p>
            <Button onClick={() => window.location.href = "/products"}>
              إضافة منتج
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
