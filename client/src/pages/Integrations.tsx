import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { 
  Loader2, 
  Upload, 
  Settings, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Zap,
  FileSpreadsheet,
  Bot,
  Webhook
} from "lucide-react";

// Supported carriers
const CARRIERS = [
  { id: "aramex", name: "Aramex", nameAr: "أرامكس" },
  { id: "smsa", name: "SMSA", nameAr: "سمسا" },
  { id: "dhl", name: "DHL", nameAr: "دي إتش إل" },
  { id: "fetchr", name: "Fetchr", nameAr: "فيتشر" },
  { id: "naqel", name: "Naqel", nameAr: "ناقل" },
];

export default function Integrations() {
  const showMessage = (title: string, description?: string, variant?: string) => {
    if (variant === "destructive") {
      alert(`❌ ${title}${description ? "\n" + description : ""}`);
    } else {
      alert(`✅ ${title}${description ? "\n" + description : ""}`);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("sheet");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedData, setUploadedData] = useState<any[]>([]);

  // Queries
  const { data: addonStatus, refetch: refetchAddon } = trpc.shippingIntegrations.getAddonStatus.useQuery();
  const { data: carrierConfigs, refetch: refetchConfigs } = trpc.shippingIntegrations.getCarrierConfigs.useQuery();
  const { data: syncLogs } = trpc.shippingIntegrations.getSyncLogs.useQuery({ limit: 5 });
  const { data: defaultMapping } = trpc.shippingIntegrations.getDefaultColumnMapping.useQuery(
    { carrier: selectedCarrier },
    { enabled: !!selectedCarrier }
  );

  // Mutations
  const activateAddon = trpc.shippingIntegrations.activateAddon.useMutation({
    onSuccess: () => {
      showMessage("تم تفعيل الإضافة بنجاح", "يمكنك الآن استخدام أتمتة الشحن");
      refetchAddon();
    },
    onError: (err) => {
      showMessage("خطأ", err.message, "destructive");
    },
  });

  const saveConfig = trpc.shippingIntegrations.saveCarrierConfig.useMutation({
    onSuccess: () => {
      showMessage("تم حفظ الإعدادات");
      refetchConfigs();
    },
    onError: (err) => {
      showMessage("خطأ", err.message, "destructive");
    },
  });

  const importSheet = trpc.shippingIntegrations.importFromSheet.useMutation({
    onSuccess: (result) => {
      showMessage("تم الاستيراد", `تم معالجة ${result.processed} سجل، تحديث ${result.updated}. الرصيد المتبقي: ${result.usageRemaining}`);
      setUploadedData([]);
      refetchAddon();
    },
    onError: (err) => {
      showMessage("خطأ في الاستيراد", err.message, "destructive");
    },
  });

  const triggerRpa = trpc.shippingIntegrations.triggerRpaSync.useMutation({
    onSuccess: (result) => {
      showMessage("تم إرسال الطلب", result.message);
      refetchAddon();
    },
    onError: (err) => {
      showMessage("خطأ", err.message, "destructive");
    },
  });

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      
      if (lines.length < 2) {
        showMessage("خطأ", "الملف فارغ أو لا يحتوي على بيانات", "destructive");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const data = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || "";
        });
        return row;
      });

      setUploadedData(data);
      showMessage("تم تحميل الملف", `${data.length} سجل جاهز للاستيراد`);
    } catch (err) {
      showMessage("خطأ في قراءة الملف", undefined, "destructive");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = () => {
    if (!selectedCarrier || uploadedData.length === 0) return;
    importSheet.mutate({ carrier: selectedCarrier, data: uploadedData });
  };

  const handleSaveConfig = () => {
    if (!selectedCarrier) return;
    saveConfig.mutate({
      carrier: selectedCarrier,
      mode: selectedMode as "api" | "sheet" | "rpa",
    });
  };

  const getCarrierConfig = (carrierId: string) => {
    return carrierConfigs?.find((c: any) => c.carrier === carrierId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التكاملات</h1>
          <p className="text-muted-foreground">إدارة تكاملات شركات الشحن</p>
        </div>
      </div>

      {/* Add-on Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>أتمتة الشحن</CardTitle>
                <CardDescription>تتبع الشحنات وتحصيل COD تلقائياً</CardDescription>
              </div>
            </div>
            {addonStatus?.isActive ? (
              <Badge variant={addonStatus.status === "trial" ? "secondary" : "default"}>
                {addonStatus.status === "trial" ? "فترة تجريبية" : "مفعّل"}
              </Badge>
            ) : (
              <Button onClick={() => activateAddon.mutate({ startTrial: true })} disabled={activateAddon.isPending}>
                {activateAddon.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                تفعيل (تجريبي)
              </Button>
            )}
          </div>
        </CardHeader>
        {addonStatus?.isActive && (
          <CardContent>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">الرصيد المتبقي:</span>
                <span className="font-medium mr-2">{addonStatus.usageRemaining} / {addonStatus.usageLimit}</span>
              </div>
              <div>
                <span className="text-muted-foreground">ينتهي في:</span>
                <span className="font-medium mr-2">
                  {addonStatus.expiresAt ? new Date(addonStatus.expiresAt).toLocaleDateString("ar-SA") : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Carrier Configuration */}
      {addonStatus?.isActive && (
        <Card>
          <CardHeader>
            <CardTitle>إعداد شركات الشحن</CardTitle>
            <CardDescription>اختر شركة الشحن وطريقة التكامل</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Carrier Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>شركة الشحن</Label>
                <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر شركة الشحن" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <span>{c.nameAr}</span>
                          {getCarrierConfig(c.id) && (
                            <Badge variant="outline" className="text-xs">
                              {getCarrierConfig(c.id)?.mode}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>طريقة التكامل</Label>
                <Select value={selectedMode} onValueChange={setSelectedMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4" />
                        <span>API / Webhook</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="sheet">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>استيراد ملف (CSV/Excel)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="rpa">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <span>RPA (أتمتة البوابة)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCarrier && (
              <Button onClick={handleSaveConfig} disabled={saveConfig.isPending}>
                {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Settings className="h-4 w-4 ml-2" />}
                حفظ الإعدادات
              </Button>
            )}

            {/* Integration Mode Tabs */}
            {selectedCarrier && (
              <Tabs value={selectedMode} onValueChange={setSelectedMode} className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="api">API</TabsTrigger>
                  <TabsTrigger value="sheet">ملف</TabsTrigger>
                  <TabsTrigger value="rpa">RPA</TabsTrigger>
                </TabsList>

                <TabsContent value="api" className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      يتم استقبال التحديثات تلقائياً عبر Webhook من شركة الشحن.
                      استخدم الـ endpoint التالي في إعدادات شركة الشحن:
                    </p>
                    <code className="block mt-2 p-2 bg-background rounded text-xs">
                      POST /api/shipping/webhook/{selectedCarrier}
                    </code>
                  </div>
                </TabsContent>

                <TabsContent value="sheet" className="space-y-4">
                  {/* Column Mapping Preview */}
                  {defaultMapping && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">تعيين الأعمدة المتوقعة:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(defaultMapping).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono">{value as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      اسحب ملف CSV أو Excel هنا أو
                    </p>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                      اختر ملف
                    </Button>
                  </div>

                  {/* Upload Preview */}
                  {uploadedData.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm">{uploadedData.length} سجل جاهز للاستيراد</p>
                        <Button onClick={handleImport} disabled={importSheet.isPending}>
                          {importSheet.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                          استيراد
                        </Button>
                      </div>
                      <div className="max-h-40 overflow-auto border rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              {Object.keys(uploadedData[0] || {}).slice(0, 5).map((h) => (
                                <th key={h} className="p-2 text-right">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {uploadedData.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-t">
                                {Object.values(row).slice(0, 5).map((v, j) => (
                                  <td key={j} className="p-2">{String(v)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="rpa" className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-4">
                      يتم استخدام أتمتة المتصفح (RPA) للدخول إلى بوابة شركة الشحن
                      وجلب حالات الشحنات تلقائياً.
                    </p>
                    <Button 
                      onClick={() => triggerRpa.mutate({ carrier: selectedCarrier })}
                      disabled={triggerRpa.isPending}
                    >
                      {triggerRpa.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Bot className="h-4 w-4 ml-2" />}
                      تشغيل المزامنة
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync Logs */}
      {addonStatus?.isActive && syncLogs && syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              سجل المزامنة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {log.errors?.length > 0 ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{log.carrier}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.mode} • {log.records_updated} تحديث
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.synced_at).toLocaleString("ar-SA")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
