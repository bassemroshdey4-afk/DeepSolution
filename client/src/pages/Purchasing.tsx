import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Truck, FileText, Users } from "lucide-react";

export default function Purchasing() {
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const [newSupplier, setNewSupplier] = useState({ name: "", contactName: "", email: "", phone: "", paymentTerms: "net_30" });
  const [newPO, setNewPO] = useState({ supplierId: "", expectedDelivery: "", notes: "", items: [{ productId: "", quantity: 1, unitCost: 0 }] });

  const { data: suppliers, refetch: refetchSuppliers } = trpc.inventory.listSuppliers.useQuery({});
  const { data: purchaseOrders, refetch: refetchPOs } = trpc.inventory.listPurchaseOrders.useQuery({});
  const { data: products } = trpc.inventory.getStockLevels.useQuery({});

  const createSupplierMutation = trpc.inventory.createSupplier.useMutation({
    onSuccess: () => { refetchSuppliers(); setCreateSupplierOpen(false); setNewSupplier({ name: "", contactName: "", email: "", phone: "", paymentTerms: "net_30" }); alert("تم إنشاء المورد"); },
    onError: (err: any) => alert("خطأ: " + err.message),
  });

  const createPOMutation = trpc.inventory.createPurchaseOrder.useMutation({
    onSuccess: () => { refetchPOs(); setCreatePOOpen(false); setNewPO({ supplierId: "", expectedDelivery: "", notes: "", items: [{ productId: "", quantity: 1, unitCost: 0 }] }); alert("تم إنشاء طلب الشراء"); },
    onError: (err: any) => alert("خطأ: " + err.message),
  });

  const receivePOMutation = trpc.inventory.receivePurchaseOrder.useMutation({
    onSuccess: () => { refetchPOs(); setReceiveOpen(false); setSelectedPO(null); alert("تم استلام البضاعة"); },
    onError: (err: any) => alert("خطأ: " + err.message),
  });

  const handleCreateSupplier = () => { if (!newSupplier.name) return; createSupplierMutation.mutate(newSupplier); };
  const handleCreatePO = () => {
    if (!newPO.supplierId) return;
    const validItems = newPO.items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) return;
    createPOMutation.mutate({ supplierId: newPO.supplierId, expectedDelivery: newPO.expectedDelivery || undefined, notes: newPO.notes || undefined, items: validItems });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", sent: "outline", partially_received: "default", received: "default", cancelled: "destructive" };
    const labels: Record<string, string> = { draft: "مسودة", sent: "مرسل", partially_received: "استلام جزئي", received: "مستلم", cancelled: "ملغي" };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const addPOItem = () => setNewPO(prev => ({ ...prev, items: [...prev.items, { productId: "", quantity: 1, unitCost: 0 }] }));
  const updatePOItem = (index: number, field: string, value: any) => setNewPO(prev => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item) }));
  const removePOItem = (index: number) => setNewPO(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold">المشتريات</h1><p className="text-muted-foreground">إدارة الموردين وطلبات الشراء</p></div>
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="flex items-center gap-2"><FileText className="h-4 w-4" />طلبات الشراء</TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2"><Users className="h-4 w-4" />الموردين</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>طلبات الشراء</CardTitle>
              <Dialog open={createPOOpen} onOpenChange={setCreatePOOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />طلب شراء جديد</Button></DialogTrigger>
                <DialogContent className="max-w-2xl" dir="rtl">
                  <DialogHeader><DialogTitle>إنشاء طلب شراء</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>المورد</Label>
                        <Select value={newPO.supplierId} onValueChange={(v) => setNewPO(prev => ({ ...prev, supplierId: v }))}>
                          <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                          <SelectContent>{suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>تاريخ التسليم المتوقع</Label><Input type="date" value={newPO.expectedDelivery} onChange={(e) => setNewPO(prev => ({ ...prev, expectedDelivery: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><Label>المنتجات</Label><Button type="button" variant="outline" size="sm" onClick={addPOItem}><Plus className="h-4 w-4 ml-1" />إضافة</Button></div>
                      <div className="space-y-2">
                        {newPO.items.map((item, index) => (
                          <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Select value={item.productId} onValueChange={(v) => updatePOItem(index, "productId", v)}>
                                <SelectTrigger><SelectValue placeholder="المنتج" /></SelectTrigger>
                                <SelectContent>{products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="w-24"><Input type="number" min="1" placeholder="الكمية" value={item.quantity} onChange={(e) => updatePOItem(index, "quantity", parseInt(e.target.value) || 1)} /></div>
                            <div className="w-28"><Input type="number" min="0" step="0.01" placeholder="السعر" value={item.unitCost} onChange={(e) => updatePOItem(index, "unitCost", parseFloat(e.target.value) || 0)} /></div>
                            {newPO.items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removePOItem(index)}>✕</Button>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={newPO.notes} onChange={(e) => setNewPO(prev => ({ ...prev, notes: e.target.value }))} placeholder="ملاحظات..." /></div>
                    <Button onClick={handleCreatePO} disabled={createPOMutation.isPending} className="w-full">{createPOMutation.isPending ? "جاري الإنشاء..." : "إنشاء طلب الشراء"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!purchaseOrders || purchaseOrders.length === 0 ? <div className="text-center py-8 text-muted-foreground">لا توجد طلبات شراء</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>رقم الطلب</TableHead><TableHead>المورد</TableHead><TableHead>التاريخ</TableHead><TableHead className="text-center">الإجمالي</TableHead><TableHead className="text-center">الحالة</TableHead><TableHead className="text-center">إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono">{po.po_number}</TableCell>
                        <TableCell>{po.supplier_name || "-"}</TableCell>
                        <TableCell>{new Date(po.created_at).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell className="text-center font-semibold">${po.total?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(po.status)}</TableCell>
                        <TableCell className="text-center">
                          {(po.status === "sent" || po.status === "partially_received") && (
                            <Button variant="outline" size="sm" onClick={() => { setSelectedPO(po); setReceiveOpen(true); }}><Truck className="h-4 w-4 ml-1" />استلام</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>الموردين</CardTitle>
              <Dialog open={createSupplierOpen} onOpenChange={setCreateSupplierOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />مورد جديد</Button></DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader><DialogTitle>إضافة مورد جديد</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>اسم المورد *</Label><Input value={newSupplier.name} onChange={(e) => setNewSupplier(prev => ({ ...prev, name: e.target.value }))} placeholder="اسم الشركة" /></div>
                    <div className="space-y-2"><Label>جهة الاتصال</Label><Input value={newSupplier.contactName} onChange={(e) => setNewSupplier(prev => ({ ...prev, contactName: e.target.value }))} placeholder="اسم الشخص" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>البريد</Label><Input type="email" value={newSupplier.email} onChange={(e) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>الهاتف</Label><Input value={newSupplier.phone} onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>شروط الدفع</Label>
                      <Select value={newSupplier.paymentTerms} onValueChange={(v) => setNewSupplier(prev => ({ ...prev, paymentTerms: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cod">عند الاستلام</SelectItem><SelectItem value="prepaid">مقدم</SelectItem>
                          <SelectItem value="net_15">15 يوم</SelectItem><SelectItem value="net_30">30 يوم</SelectItem><SelectItem value="net_60">60 يوم</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateSupplier} disabled={createSupplierMutation.isPending} className="w-full">{createSupplierMutation.isPending ? "جاري الإنشاء..." : "إضافة المورد"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!suppliers || suppliers.length === 0 ? <div className="text-center py-8 text-muted-foreground">لا يوجد موردين</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>اسم المورد</TableHead><TableHead>جهة الاتصال</TableHead><TableHead>البريد</TableHead><TableHead>الهاتف</TableHead><TableHead className="text-center">الحالة</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {suppliers.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.contact_name || "-"}</TableCell>
                        <TableCell>{s.email || "-"}</TableCell>
                        <TableCell>{s.phone || "-"}</TableCell>
                        <TableCell className="text-center"><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "نشط" : "غير نشط"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>استلام طلب الشراء - {selectedPO?.po_number}</DialogTitle></DialogHeader>
          {selectedPO && <ReceiveForm po={selectedPO} onReceive={(items) => receivePOMutation.mutate({ poId: selectedPO.id, items })} isPending={receivePOMutation.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiveForm({ po, onReceive, isPending }: { po: any; onReceive: (items: any[]) => void; isPending: boolean }) {
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>({});
  const items = po.items || [];
  const handleSubmit = () => {
    const itemsToReceive = Object.entries(receivedItems).filter(([_, qty]) => qty > 0).map(([productId, receivedQuantity]) => ({ productId, receivedQuantity }));
    if (itemsToReceive.length === 0) { alert("يرجى إدخال كمية"); return; }
    onReceive(itemsToReceive);
  };
  return (
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">أدخل الكميات المستلمة</p>
      {items.length === 0 ? <div className="text-center py-4 text-muted-foreground">لا توجد بنود</div> : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.product_id} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="flex-1"><div className="font-medium">{item.product_name || item.product_id}</div><div className="text-sm text-muted-foreground">مطلوب: {item.quantity} | مستلم: {item.received_quantity || 0}</div></div>
              <div className="w-24"><Input type="number" min="0" max={item.quantity - (item.received_quantity || 0)} value={receivedItems[item.product_id] || ""} onChange={(e) => setReceivedItems(prev => ({ ...prev, [item.product_id]: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          ))}
        </div>
      )}
      <Button onClick={handleSubmit} disabled={isPending} className="w-full">{isPending ? "جاري الاستلام..." : "تأكيد الاستلام"}</Button>
    </div>
  );
}
