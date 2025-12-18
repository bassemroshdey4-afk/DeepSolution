/**
 * Super Admin Dashboard - Platform-level administration
 * Functional-first, minimal UI
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Users, Building2, CreditCard, Bot, Shield, ArrowRight } from "lucide-react";

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [aiLimit, setAiLimit] = useState("");

  // Check super admin access
  const { data: access, isLoading: accessLoading } = trpc.superAdmin.checkAccess.useQuery();
  
  // Get platform stats
  const { data: stats } = trpc.superAdmin.getStats.useQuery(undefined, {
    enabled: access?.isSuperAdmin === true,
  });

  // Get tenants list
  const { data: tenantsData, refetch: refetchTenants } = trpc.superAdmin.listTenants.useQuery(
    { page: 1, limit: 50 },
    { enabled: access?.isSuperAdmin === true }
  );

  // Get selected tenant details
  const { data: tenantDetails } = trpc.superAdmin.getTenant.useQuery(
    { tenantId: selectedTenant! },
    { enabled: !!selectedTenant && access?.isSuperAdmin === true }
  );

  // Mutations
  const updateSubscription = trpc.superAdmin.updateSubscription.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchTenants();
    },
    onError: (err) => toast.error(err.message),
  });

  const setTenantStatus = trpc.superAdmin.setTenantStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchTenants();
    },
    onError: (err) => toast.error(err.message),
  });

  const setAILimits = trpc.superAdmin.setAILimits.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setAiLimit("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Loading state
  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Access denied
  if (!access?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-500">
              <Shield className="w-12 h-12 mx-auto mb-4" />
              غير مصرح
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            ليس لديك صلاحيات Super Admin للوصول لهذه الصفحة
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      trial: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      past_due: "bg-yellow-100 text-yellow-800",
      canceled: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
    };
    return <Badge className={colors[status] || "bg-gray-100"}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">لوحة Super Admin</h1>
            <p className="text-muted-foreground">إدارة المنصة والمستأجرين</p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Shield className="w-4 h-4 ml-2" />
            {user?.email}
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building2 className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalTenants || 0}</p>
                  <p className="text-sm text-muted-foreground">إجمالي المستأجرين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                  <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CreditCard className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.byStatus?.active || 0}</p>
                  <p className="text-sm text-muted-foreground">اشتراكات نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Bot className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.byStatus?.trial || 0}</p>
                  <p className="text-sm text-muted-foreground">فترات تجريبية</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tenants List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>المستأجرين ({tenantsData?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {tenantsData?.tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTenant === tenant.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedTenant(tenant.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.slug}.deepsolution.com</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(tenant.subscription?.status || "unknown")}
                        <Badge variant="outline">{tenant.userCount} مستخدم</Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
                {tenantsData?.tenants.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا يوجد مستأجرين</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tenant Actions */}
          <Card>
            <CardHeader>
              <CardTitle>إجراءات المستأجر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedTenant && tenantDetails ? (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-semibold text-lg">{tenantDetails.name}</p>
                    <p className="text-sm text-muted-foreground">{tenantDetails.slug}</p>
                    <p className="text-sm mt-2">
                      المستخدمين: {tenantDetails.users?.length || 0} | 
                      محادثات AI: {tenantDetails.aiConversationsCount}
                    </p>
                  </div>

                  {/* Subscription Plan */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">خطة الاشتراك</label>
                    <Select
                      value={tenantDetails.subscriptions?.[0]?.plan || "trial"}
                      onValueChange={(plan) => {
                        updateSubscription.mutate({
                          tenantId: selectedTenant,
                          plan: plan as "trial" | "starter" | "growth" | "enterprise",
                          status: tenantDetails.subscriptions?.[0]?.status || "active",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial - تجريبي</SelectItem>
                        <SelectItem value="starter">Starter - مبتدئ</SelectItem>
                        <SelectItem value="growth">Growth - نمو</SelectItem>
                        <SelectItem value="enterprise">Enterprise - مؤسسات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Account Status */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">حالة الحساب</label>
                    <div className="flex gap-2">
                      <Button
                        variant={tenantDetails.subscriptions?.[0]?.status === "canceled" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setTenantStatus.mutate({ tenantId: selectedTenant, suspended: false })}
                        disabled={setTenantStatus.isPending}
                      >
                        تفعيل
                      </Button>
                      <Button
                        variant={tenantDetails.subscriptions?.[0]?.status === "canceled" ? "outline" : "destructive"}
                        className="flex-1"
                        onClick={() => setTenantStatus.mutate({ tenantId: selectedTenant, suspended: true })}
                        disabled={setTenantStatus.isPending}
                      >
                        تعليق
                      </Button>
                    </div>
                  </div>

                  {/* AI Limits */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">حد AI الشهري</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="مثال: 1000"
                        value={aiLimit}
                        onChange={(e) => setAiLimit(e.target.value)}
                      />
                      <Button
                        onClick={() => {
                          if (aiLimit) {
                            setAILimits.mutate({
                              tenantId: selectedTenant,
                              monthlyLimit: parseInt(aiLimit),
                            });
                          }
                        }}
                        disabled={!aiLimit || setAILimits.isPending}
                      >
                        تعيين
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  اختر مستأجر من القائمة لعرض الإجراءات
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
