import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy, Sparkles, FileText } from "lucide-react";

const contentTypes = [
  { value: "product_description", label: "وصف منتج", icon: "📦" },
  { value: "ad_copy", label: "نص إعلاني", icon: "📢" },
  { value: "social_post", label: "منشور سوشيال ميديا", icon: "📱" },
  { value: "email", label: "بريد إلكتروني تسويقي", icon: "📧" },
  { value: "landing_page_text", label: "نص صفحة هبوط", icon: "🎯" },
  { value: "blog_intro", label: "مقدمة مقال", icon: "📝" },
];

const tones = [
  { value: "professional", label: "احترافي" },
  { value: "casual", label: "عفوي" },
  { value: "persuasive", label: "مقنع" },
  { value: "friendly", label: "ودي" },
  { value: "luxury", label: "فاخر" },
];

const languages = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

export default function ContentWriter() {
  const [contentType, setContentType] = useState<string>("product_description");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const [language, setLanguage] = useState<string>("ar");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");

  const generateMutation = trpc.aiAddons.generateContent.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(typeof data.content === 'string' ? data.content : '');
      toast.success(`تم توليد المحتوى بنجاح! الاستخدام المتبقي: ${data.usageRemaining}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleGenerate = () => {
    if (!productName && !productDescription) {
      toast.error("يرجى إدخال اسم المنتج أو وصفه على الأقل");
      return;
    }

    generateMutation.mutate({
      contentType: contentType as any,
      productName: productName || undefined,
      productDescription: productDescription || undefined,
      targetAudience: targetAudience || undefined,
      tone: tone as any,
      language: language as any,
      additionalContext: additionalContext || undefined,
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("تم نسخ المحتوى");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">كاتب المحتوى الذكي</h1>
          <p className="text-muted-foreground">أنشئ محتوى تسويقي احترافي بالذكاء الاصطناعي</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>إعدادات المحتوى</CardTitle>
            <CardDescription>حدد نوع المحتوى والتفاصيل المطلوبة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content Type */}
            <div className="space-y-2">
              <Label>نوع المحتوى</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Name */}
            <div className="space-y-2">
              <Label>اسم المنتج</Label>
              <Input
                placeholder="مثال: ساعة ذكية رياضية"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {/* Product Description */}
            <div className="space-y-2">
              <Label>وصف المنتج</Label>
              <Textarea
                placeholder="صف المنتج بإيجاز..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label>الجمهور المستهدف (اختياري)</Label>
              <Input
                placeholder="مثال: الشباب المهتمين بالرياضة"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            {/* Tone & Language */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الأسلوب</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>اللغة</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <Label>معلومات إضافية (اختياري)</Label>
              <Textarea
                placeholder="أي تفاصيل إضافية تريد تضمينها..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={2}
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
              size="lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Sparkles className="ml-2 h-4 w-4" />
                  توليد المحتوى
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>المحتوى المُولّد</span>
              {generatedContent && (
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="ml-2 h-4 w-4" />
                  نسخ
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              {generatedContent
                ? "تم توليد المحتوى بنجاح"
                : "سيظهر المحتوى المُولّد هنا"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generateMutation.isPending ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">جاري توليد المحتوى...</p>
                </div>
              </div>
            ) : generatedContent ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {generatedContent}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Sparkles className="h-12 w-12 mx-auto opacity-20" />
                  <p>أدخل تفاصيل المنتج واضغط "توليد المحتوى"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
