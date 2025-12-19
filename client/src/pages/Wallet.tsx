import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Wallet() {
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpDescription, setTopUpDescription] = useState("");
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = trpc.wallet.getBalance.useQuery();
  const { data: transactionsData, isLoading: txLoading, refetch: refetchTx } = trpc.wallet.getTransactions.useQuery({ limit: 20 });

  const topUpMutation = trpc.wallet.topUp.useMutation({
    onSuccess: (data) => {
      toast.success(`تم شحن المحفظة بنجاح! الرصيد الجديد: ${data.newBalance} ر.س`);
      setIsTopUpOpen(false);
      setTopUpAmount("");
      setTopUpDescription("");
      refetchBalance();
      refetchTx();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("الرجاء إدخال مبلغ صحيح");
      return;
    }
    topUpMutation.mutate({
      amount,
      description: topUpDescription || "شحن المحفظة",
      reference_type: "manual",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "credit":
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case "debit":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "refund":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "credit":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">إيداع</Badge>;
      case "debit":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">خصم</Badge>;
      case "refund":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">استرداد</Badge>;
      case "adjustment":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">تعديل</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">المحفظة</h1>
            <p className="text-muted-foreground">إدارة رصيد المحفظة والمعاملات</p>
          </div>
          <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                شحن المحفظة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>شحن المحفظة</DialogTitle>
                <DialogDescription>
                  أدخل المبلغ الذي تريد إضافته إلى رصيد المحفظة
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ (ر.س)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف (اختياري)</Label>
                  <Input
                    id="description"
                    placeholder="سبب الشحن..."
                    value={topUpDescription}
                    onChange={(e) => setTopUpDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTopUpOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleTopUp} disabled={topUpMutation.isPending}>
                  {topUpMutation.isPending ? "جاري الشحن..." : "شحن"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              الرصيد الحالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="animate-pulse h-12 bg-muted rounded"></div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {balanceData?.balance?.toFixed(2) || "0.00"}
                </span>
                <span className="text-xl text-muted-foreground">
                  {balanceData?.wallet?.currency || "SAR"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsTopUpOpen(true)}>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Plus className="h-8 w-8 text-green-500 mb-2" />
              <span className="font-medium">شحن</span>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors opacity-50">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <ArrowUpRight className="h-8 w-8 text-blue-500 mb-2" />
              <span className="font-medium">تحويل</span>
              <span className="text-xs text-muted-foreground">قريباً</span>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors opacity-50">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <RefreshCw className="h-8 w-8 text-purple-500 mb-2" />
              <span className="font-medium">استرداد</span>
              <span className="text-xs text-muted-foreground">قريباً</span>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { refetchBalance(); refetchTx(); }}>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <History className="h-8 w-8 text-gray-500 mb-2" />
              <span className="font-medium">تحديث</span>
            </CardContent>
          </Card>
        </div>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>سجل المعاملات</CardTitle>
            <CardDescription>آخر {transactionsData?.transactions?.length || 0} معاملة</CardDescription>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="h-10 w-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : transactionsData?.transactions?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد معاملات بعد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactionsData?.transactions?.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{tx.description}</span>
                        {getTransactionBadge(tx.type)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                    <div className={`text-lg font-semibold ${tx.type === "credit" || tx.type === "refund" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "credit" || tx.type === "refund" ? "+" : "-"}
                      {parseFloat(tx.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
