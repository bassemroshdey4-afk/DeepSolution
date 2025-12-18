import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Store, Globe, Clock, DollarSign, Languages } from "lucide-react";

// قوائم الدول والعملات واللغات والمناطق الزمنية
const COUNTRIES = [
  { code: "SA", name: "المملكة العربية السعودية", currency: "SAR", timezone: "Asia/Riyadh" },
  { code: "AE", name: "الإمارات العربية المتحدة", currency: "AED", timezone: "Asia/Dubai" },
  { code: "EG", name: "مصر", currency: "EGP", timezone: "Africa/Cairo" },
  { code: "KW", name: "الكويت", currency: "KWD", timezone: "Asia/Kuwait" },
  { code: "QA", name: "قطر", currency: "QAR", timezone: "Asia/Qatar" },
  { code: "BH", name: "البحرين", currency: "BHD", timezone: "Asia/Bahrain" },
  { code: "OM", name: "عُمان", currency: "OMR", timezone: "Asia/Muscat" },
  { code: "JO", name: "الأردن", currency: "JOD", timezone: "Asia/Amman" },
  { code: "LB", name: "لبنان", currency: "LBP", timezone: "Asia/Beirut" },
  { code: "MA", name: "المغرب", currency: "MAD", timezone: "Africa/Casablanca" },
  { code: "TN", name: "تونس", currency: "TND", timezone: "Africa/Tunis" },
  { code: "DZ", name: "الجزائر", currency: "DZD", timezone: "Africa/Algiers" },
  { code: "IQ", name: "العراق", currency: "IQD", timezone: "Asia/Baghdad" },
  { code: "SY", name: "سوريا", currency: "SYP", timezone: "Asia/Damascus" },
  { code: "PS", name: "فلسطين", currency: "ILS", timezone: "Asia/Gaza" },
  { code: "YE", name: "اليمن", currency: "YER", timezone: "Asia/Aden" },
  { code: "LY", name: "ليبيا", currency: "LYD", timezone: "Africa/Tripoli" },
  { code: "SD", name: "السودان", currency: "SDG", timezone: "Africa/Khartoum" },
  { code: "US", name: "الولايات المتحدة", currency: "USD", timezone: "America/New_York" },
  { code: "GB", name: "المملكة المتحدة", currency: "GBP", timezone: "Europe/London" },
  { code: "DE", name: "ألمانيا", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "FR", name: "فرنسا", currency: "EUR", timezone: "Europe/Paris" },
  { code: "TR", name: "تركيا", currency: "TRY", timezone: "Europe/Istanbul" },
];

const CURRENCIES = [
  { code: "SAR", name: "ريال سعودي", symbol: "ر.س" },
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ" },
  { code: "EGP", name: "جنيه مصري", symbol: "ج.م" },
  { code: "KWD", name: "دينار كويتي", symbol: "د.ك" },
  { code: "QAR", name: "ريال قطري", symbol: "ر.ق" },
  { code: "BHD", name: "دينار بحريني", symbol: "د.ب" },
  { code: "OMR", name: "ريال عُماني", symbol: "ر.ع" },
  { code: "JOD", name: "دينار أردني", symbol: "د.أ" },
  { code: "USD", name: "دولار أمريكي", symbol: "$" },
  { code: "EUR", name: "يورو", symbol: "€" },
  { code: "GBP", name: "جنيه إسترليني", symbol: "£" },
  { code: "TRY", name: "ليرة تركية", symbol: "₺" },
  { code: "MAD", name: "درهم مغربي", symbol: "د.م" },
  { code: "TND", name: "دينار تونسي", symbol: "د.ت" },
  { code: "DZD", name: "دينار جزائري", symbol: "د.ج" },
  { code: "IQD", name: "دينار عراقي", symbol: "د.ع" },
];

const LANGUAGES = [
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "tr", name: "Türkçe", dir: "ltr" },
];

const TIMEZONES = [
  { code: "Asia/Riyadh", name: "توقيت الرياض (GMT+3)", offset: "+03:00" },
  { code: "Asia/Dubai", name: "توقيت دبي (GMT+4)", offset: "+04:00" },
  { code: "Africa/Cairo", name: "توقيت القاهرة (GMT+2)", offset: "+02:00" },
  { code: "Asia/Kuwait", name: "توقيت الكويت (GMT+3)", offset: "+03:00" },
  { code: "Asia/Qatar", name: "توقيت الدوحة (GMT+3)", offset: "+03:00" },
  { code: "Asia/Bahrain", name: "توقيت المنامة (GMT+3)", offset: "+03:00" },
  { code: "Asia/Muscat", name: "توقيت مسقط (GMT+4)", offset: "+04:00" },
  { code: "Asia/Amman", name: "توقيت عمّان (GMT+3)", offset: "+03:00" },
  { code: "Asia/Beirut", name: "توقيت بيروت (GMT+2)", offset: "+02:00" },
  { code: "Africa/Casablanca", name: "توقيت الدار البيضاء (GMT+1)", offset: "+01:00" },
  { code: "Europe/Istanbul", name: "توقيت إسطنبول (GMT+3)", offset: "+03:00" },
  { code: "Europe/London", name: "توقيت لندن (GMT+0)", offset: "+00:00" },
  { code: "Europe/Paris", name: "توقيت باريس (GMT+1)", offset: "+01:00" },
  { code: "America/New_York", name: "توقيت نيويورك (GMT-5)", offset: "-05:00" },
];

export default function TenantOnboarding() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  
  // Step 2: Localization
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [language, setLanguage] = useState("ar");
  const [timezone, setTimezone] = useState("");

  // التحقق من حالة الـ onboarding
  const { data: onboardingStatus, isLoading: statusLoading } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: !!user,
  });

  // إذا أكمل المستخدم الـ onboarding، توجيهه للـ Dashboard
  const shouldRedirect = user && onboardingStatus?.hasCompletedOnboarding;
  
  // استخدام useEffect للتوجيه لتجنب استدعاء setLocation في render phase
  useEffect(() => {
    if (shouldRedirect) {
      setLocation("/");
    }
  }, [shouldRedirect, setLocation]);

  if (shouldRedirect) {
    return null;
  }

  const createTenantMutation = trpc.onboarding.createTenant.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "تم إنشاء حسابك بنجاح!");
      toast.info("🎉 لديك 7 أيام تجريبية مجانية!", { duration: 5000 });
      setLocation("/dashboard");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء الحساب");
      setIsLoading(false);
    },
  });

  // Auto-fill currency and timezone when country changes
  const handleCountryChange = (countryCode: string) => {
    setCountry(countryCode);
    const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
    if (selectedCountry) {
      setCurrency(selectedCountry.currency);
      setTimezone(selectedCountry.timezone);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("يرجى إدخال اسم المتجر");
        return;
      }
      if (!domain.trim() || domain.length < 3) {
        toast.error("يرجى إدخال نطاق فرعي صالح (3 أحرف على الأقل)");
        return;
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!country) {
      toast.error("يرجى اختيار الدولة");
      return;
    }
    if (!currency) {
      toast.error("يرجى اختيار العملة");
      return;
    }
    if (!timezone) {
      toast.error("يرجى اختيار المنطقة الزمنية");
      return;
    }
    
    setIsLoading(true);

    createTenantMutation.mutate({
      name,
      slug: domain.toLowerCase(),
      country,
      currency,
      language,
      timezone,
    });
  };

  // إذا كان التحميل جاري
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن المستخدم مسجل الدخول
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Store className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">مرحباً في DeepSolution</CardTitle>
            <CardDescription className="text-base">
              سجّل دخولك للبدء في إنشاء متجرك الإلكتروني
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full h-12 text-lg" 
              onClick={() => window.location.href = getLoginUrl()}
            >
              تسجيل الدخول
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ستحصل على فترة تجريبية مجانية لمدة 7 أيام بعد إنشاء حسابك
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">مرحباً في DeepSolution</CardTitle>
          <CardDescription className="text-base">
            {step === 1 
              ? "أنشئ حسابك الآن وابدأ في إدارة تجارتك الإلكترونية بذكاء اصطناعي"
              : "حدد إعدادات التوطين لمتجرك"
            }
          </CardDescription>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <div className={`w-3 h-3 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-12 h-1 rounded transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
          <p className="text-sm text-muted-foreground">
            الخطوة {step} من 2
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-base font-semibold">
                    اسم المتجر أو الشركة
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="مثال: متجر الإلكترونيات الذكية"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="text-base h-12"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain" className="text-base font-semibold">
                    النطاق الفرعي (يجب أن يكون فريداً)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="domain"
                      type="text"
                      placeholder="mystore"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                      required
                      className="text-base h-12"
                      disabled={isLoading}
                      dir="ltr"
                    />
                    <span className="text-muted-foreground text-sm whitespace-nowrap">.deepsolution.com</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    يمكنك استخدام الأحرف الإنجليزية الصغيرة والأرقام والشرطات فقط
                  </p>
                </div>

                <Button 
                  type="button" 
                  onClick={handleNext}
                  className="w-full h-12 text-base font-semibold"
                >
                  التالي
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    الدولة
                  </Label>
                  <Select value={country} onValueChange={handleCountryChange}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر الدولة" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    العملة
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    لغة الواجهة
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر اللغة" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    المنطقة الزمنية
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر المنطقة الزمنية" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Trial Info Banner */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-primary">
                    🎉 ستحصل على فترة تجريبية مجانية لمدة 7 أيام
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    يمكنك إنشاء حملة واحدة خلال الفترة التجريبية
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 h-12 text-base"
                    disabled={isLoading}
                  >
                    السابق
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-12 text-base font-semibold" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      "إنشاء الحساب"
                    )}
                  </Button>
                </div>
              </>
            )}

            <p className="text-xs text-center text-muted-foreground">
              بإنشاء حساب، أنت توافق على{" "}
              <a href="#" className="text-primary hover:underline">
                شروط الخدمة
              </a>{" "}
              و
              <a href="#" className="text-primary hover:underline">
                سياسة الخصوصية
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
