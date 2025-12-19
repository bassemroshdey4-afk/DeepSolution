import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileText, Wallet, ShoppingCart, Package, Zap, RefreshCw, TrendingUp } from "lucide-react";

type LogType = 'wallet' | 'order' | 'inventory' | 'ai_usage' | 'profit' | undefined;

export default function AuditLog() {
  const [selectedType, setSelectedType] = useState<LogType>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.auditLog.getSummary.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = trpc.auditLog.getLogs.useQuery({
    type: selectedType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 50,
    offset: 0,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchLogs();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wallet':
        return <Wallet className="h-4 w-4" />;
      case 'order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'inventory':
        return <Package className="h-4 w-4" />;
      case 'ai_usage':
        return <Zap className="h-4 w-4" />;
      case 'profit':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'wallet':
        return 'bg-green-100 text-green-800';
      case 'order':
        return 'bg-blue-100 text-blue-800';
      case 'inventory':
        return 'bg-orange-100 text-orange-800';
      case 'ai_usage':
        return 'bg-purple-100 text-purple-800';
      case 'profit':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'wallet':
        return 'محفظة';
      case 'order':
        return 'طلب';
      case 'inventory':
        return 'مخزون';
      case 'ai_usage':
        return 'AI';
      case 'profit':
        return 'ربحية';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: unknown) => {
    if (typeof value === 'number') {
      return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">سجل المراجعة</h1>
          <p className="text-muted-foreground">عرض جميع العمليات والتغييرات في النظام</p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${selectedType === 'wallet' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setSelectedType(selectedType === 'wallet' ? undefined : 'wallet')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المحفظة</p>
                <p className="text-2xl font-bold">{summaryLoading ? '...' : summary?.wallet || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${selectedType === 'order' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setSelectedType(selectedType === 'order' ? undefined : 'order')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الطلبات</p>
                <p className="text-2xl font-bold">{summaryLoading ? '...' : summary?.order || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${selectedType === 'inventory' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setSelectedType(selectedType === 'inventory' ? undefined : 'inventory')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المخزون</p>
                <p className="text-2xl font-bold">{summaryLoading ? '...' : summary?.inventory || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${selectedType === 'ai_usage' ? 'ring-2 ring-purple-500' : ''}`}
          onClick={() => setSelectedType(selectedType === 'ai_usage' ? undefined : 'ai_usage')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">استخدام AI</p>
                <p className="text-2xl font-bold">{summaryLoading ? '...' : summary?.ai_usage || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${selectedType === 'profit' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => setSelectedType(selectedType === 'profit' ? undefined : 'profit')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الربحية</p>
                <p className="text-2xl font-bold">{summaryLoading ? '...' : summary?.profit || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الفلاتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">النوع</label>
              <Select 
                value={selectedType || 'all'} 
                onValueChange={(v) => setSelectedType(v === 'all' ? undefined : v as LogType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="wallet">المحفظة</SelectItem>
                  <SelectItem value="order">الطلبات</SelectItem>
                  <SelectItem value="inventory">المخزون</SelectItem>
                  <SelectItem value="ai_usage">استخدام AI</SelectItem>
                  <SelectItem value="profit">الربحية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">من تاريخ</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">إلى تاريخ</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>السجلات ({logsData?.total || 0})</span>
            {selectedType && (
              <Badge variant="outline" className="mr-2">
                {getTypeLabel(selectedType)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : !logsData?.logs?.length ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد سجلات</div>
          ) : (
            <div className="space-y-3">
              {logsData.logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getTypeBadgeColor(log.type)}`}>
                    {getTypeIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={getTypeBadgeColor(log.type)}>
                        {getTypeLabel(log.type)}
                      </Badge>
                      <span className="font-medium">{log.action}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.entity_type}: {log.entity_id.substring(0, 8)}...
                    </div>
                    {log.details && (
                      <div className="mt-2 text-sm bg-muted/50 p-2 rounded">
                        {Object.entries(log.details).map(([key, value]) => (
                          <span key={key} className="inline-block ml-4">
                            <span className="text-muted-foreground">{key}:</span>{' '}
                            <span className="font-medium">
                              {['revenue', 'total_cost', 'net_profit', 'amount', 'balance_before', 'balance_after', 'cost'].includes(key)
                                ? formatCurrency(value)
                                : String(value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
