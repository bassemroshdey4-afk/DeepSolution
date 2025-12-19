import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Zap, Image, TrendingUp, FileText, Check, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const addonIcons: Record<string, React.ReactNode> = {
  "Landing Page Generator": <Sparkles className="h-6 w-6" />,
  "AI Assistant Pro": <Zap className="h-6 w-6" />,
  "Image Analysis": <Image className="h-6 w-6" />,
  "Campaign Optimizer": <TrendingUp className="h-6 w-6" />,
  "Content Writer": <FileText className="h-6 w-6" />,
};

export default function AIAddons() {
  // Using sonner toast directly
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const { data: addons, isLoading: addonsLoading } = trpc.aiAddons.list.useQuery();
  const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubs } = trpc.aiAddons.getMySubscriptions.useQuery();

  const activateMutation = trpc.aiAddons.activate.useMutation({
    onSuccess: (data) => {
      toast.success("تم التفعيل بنجاح", {
        description: data.charged > 0 ? `تم خصم ${data.charged} من المحفظة` : "تم تفعيل الفترة التجريبية",
      });
      refetchSubs();
      setActivatingId(null);
    },
    onError: (error) => {
      toast.error("خطأ في التفعيل", {
        description: error.message,
      });
      setActivatingId(null);
    },
  });

  const renewMutation = trpc.aiAddons.renew.useMutation({
    onSuccess: (data) => {
      toast.success("تم التجديد بنجاح", {
        description: data.charged > 0 ? `تم خصم ${data.charged} من المحفظة` : "تم التجديد",
      });
      refetchSubs();
    },
    onError: (error) => {
      toast.error("خطأ في التجديد", {
        description: error.message,
      });
    },
  });

  const getSubscription = (addonId: string) => {
    return subscriptions?.find((s: any) => s.ai_addon_id === addonId);
  };

  const getStatusBadge = (sub: any) => {
    if (!sub) return null;
    
    const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
    
    if (isExpired || sub.status === "expired") {
      return <Badge variant="destructive">منتهي</Badge>;
    }
    if (sub.status === "trial") {
      return <Badge variant="secondary">تجريبي</Badge>;
    }
    if (sub.status === "active") {
      return <Badge className="bg-green-500">نشط</Badge>;
    }
    return <Badge variant="outline">{sub.status}</Badge>;
  };

  const handleActivate = (addonId: string, useTrial: boolean) => {
    setActivatingId(addonId);
    activateMutation.mutate({ addonId, useTrial });
  };

  const handleRenew = (subscriptionId: string) => {
    renewMutation.mutate({ subscriptionId });
  };

  if (addonsLoading || subsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">إضافات الذكاء الاصطناعي</h1>
          <p className="text-muted-foreground">فعّل إضافات AI لتعزيز قدرات متجرك</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {addons?.map((addon: any) => {
            const sub = getSubscription(addon.id);
            const isActive = sub && (sub.status === "active" || sub.status === "trial") && 
                           (!sub.expires_at || new Date(sub.expires_at) > new Date());
            const usagePercent = sub ? ((sub.usage_limit - sub.usage_remaining) / sub.usage_limit) * 100 : 0;

            return (
              <Card key={addon.id} className={isActive ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {addonIcons[addon.name] || <Sparkles className="h-6 w-6" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{addon.name_ar || addon.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {addon.billing_cycle === "monthly" ? "شهري" : addon.billing_cycle === "yearly" ? "سنوي" : "مرة واحدة"}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(sub)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {addon.description_ar || addon.description}
                  </p>

                  {isActive && sub && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>الاستخدام</span>
                        <span>{sub.usage_limit - sub.usage_remaining} / {sub.usage_limit}</span>
                      </div>
                      <Progress value={usagePercent} className="h-2" />
                      
                      {sub.usage_remaining <= 10 && (
                        <div className="flex items-center gap-2 text-amber-500 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          <span>الاستخدام المتبقي منخفض</span>
                        </div>
                      )}

                      {sub.expires_at && (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Clock className="h-3 w-3" />
                          <span>ينتهي: {new Date(sub.expires_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      {parseFloat(addon.price_amount) > 0 ? (
                        <span className="text-lg font-bold">{addon.price_amount} ر.س</span>
                      ) : (
                        <span className="text-lg font-bold text-green-500">مجاني</span>
                      )}
                    </div>
                    {addon.trial_enabled && !sub && (
                      <Badge variant="outline" className="text-xs">
                        تجربة مجانية: {addon.trial_usage_limit} استخدام
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2">
                  {!sub ? (
                    <>
                      {addon.trial_enabled && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleActivate(addon.id, true)}
                          disabled={activatingId === addon.id}
                        >
                          {activatingId === addon.id ? "جاري التفعيل..." : "تجربة مجانية"}
                        </Button>
                      )}
                      <Button
                        className="flex-1"
                        onClick={() => handleActivate(addon.id, false)}
                        disabled={activatingId === addon.id || parseFloat(addon.price_amount) === 0}
                      >
                        {activatingId === addon.id ? "جاري التفعيل..." : "تفعيل"}
                      </Button>
                    </>
                  ) : isActive ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Check className="h-4 w-4 ml-2" />
                      مفعّل
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleRenew(sub.id)}
                      disabled={renewMutation.isPending}
                    >
                      {renewMutation.isPending ? "جاري التجديد..." : "تجديد الاشتراك"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
