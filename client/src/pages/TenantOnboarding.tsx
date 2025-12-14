import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

export default function TenantOnboarding() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createTenantMutation = trpc.tenant.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء حسابك بنجاح!");
      setLocation("/");
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء الحساب");
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    createTenantMutation.mutate({
      name,
      domain: domain.toLowerCase(),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">مرحباً في DeepSolution</CardTitle>
          <CardDescription className="text-base">
            أنشئ حسابك الآن وابدأ في إدارة تجارتك الإلكترونية بذكاء اصطناعي
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                "إنشاء الحساب"
              )}
            </Button>

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
