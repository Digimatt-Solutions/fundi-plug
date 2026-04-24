import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Search, RotateCcw, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import TransactionReceipt, { getPaymentMethod } from "@/components/TransactionReceipt";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PaymentsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [resetting, setResetting] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isWorker = user?.role === "worker";

  const load = async () => {
    if (!user) return;
    let query = supabase.from("payments").select("*, jobs:job_id(title)").order("created_at", { ascending: false });
    if (!isAdmin && isWorker) {
      query = query.eq("payee_id", user!.id);
    } else if (!isAdmin) {
      query = query.eq("payer_id", user!.id);
    }
    const { data } = await query;

    const allIds = [...new Set((data || []).flatMap(p => [p.payer_id, p.payee_id]))];
    const { data: profiles } = allIds.length > 0 ? await supabase.from("profiles").select("id, name").in("id", allIds) : { data: [] };
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

    const mapped = (data || []).map(p => ({
      ...p,
      payerName: nameMap[p.payer_id] || "-",
      payeeName: nameMap[p.payee_id] || "-",
      jobTitle: (p as any).jobs?.title || "-",
    }));
    setPayments(mapped);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyAmounts: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      monthlyAmounts[months[d.getMonth()]] = 0;
    }
    mapped.filter(p => p.status === "completed").forEach(p => {
      const m = months[new Date(p.created_at).getMonth()];
      if (monthlyAmounts[m] !== undefined) monthlyAmounts[m] += Number(p.amount);
    });
    setChartData(Object.entries(monthlyAmounts).map(([month, amount]) => ({ month, amount: Math.round(amount) })));
    setLoading(false);
  };

  const handleResetPayment = async (paymentId: string) => {
    setResetting(paymentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reset_payment", paymentId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast({ title: "Payment reset", description: "Client can now retry payment." });
      load();
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setResetting(null);
    }
  };

  useEffect(() => { load(); }, [user]);

  const filtered = payments.filter(p =>
    p.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
    p.payerName.toLowerCase().includes(search.toLowerCase()) ||
    p.payeeName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("Payments")}</h1>
        <p className="text-muted-foreground text-sm">{isAdmin ? "All platform transactions" : "Your payment history"}</p>
      </div>

      {/* Payment visualization */}
      {chartData.some(d => d.amount > 0) && (
        <div className="stat-card animate-fade-in">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t("Monthly Payments")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis dataKey="month" stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} formatter={(value: any) => [`KSH ${Number(value).toLocaleString()}`, "Amount"]} />
              <Bar dataKey="amount" fill="hsl(22, 93%, 49%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t("Search payments...")} className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {filtered.length > 0 ? (
        <div className="stat-card overflow-hidden p-0 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Job")}</th>
                  {isAdmin && <th className="text-left p-4 text-muted-foreground font-medium">{t("Payer")}</th>}
                  {isAdmin && <th className="text-left p-4 text-muted-foreground font-medium">{t("Payee")}</th>}
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Amount")}</th>
                  {(isAdmin || isWorker) && <th className="text-left p-4 text-muted-foreground font-medium">{t("Commission")}</th>}
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Status")}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Date")}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Receipt")}</th>
                  {isAdmin && <th className="text-left p-4 text-muted-foreground font-medium">{t("Actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-4 text-foreground">{p.jobTitle}</td>
                    {isAdmin && <td className="p-4 text-muted-foreground">{p.payerName}</td>}
                    {isAdmin && <td className="p-4 text-muted-foreground">{p.payeeName}</td>}
                    <td className="p-4 text-foreground tabular-nums">KSH {(!isAdmin && !isWorker ? Number(p.amount) + Number(p.commission || 0) : Number(p.amount)).toLocaleString()}</td>
                    {(isAdmin || isWorker) && <td className="p-4 text-muted-foreground tabular-nums">{p.commission ? `KSH ${Number(p.commission).toLocaleString()}` : "-"}</td>}
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                        p.status === "completed" ? "bg-green-500/10 text-green-500" :
                        p.status === "pending" ? "bg-chart-4/10 text-chart-4" :
                        "bg-destructive/10 text-destructive"
                      }`}>{p.status}</span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-4">
                      {p.status === "completed" && (
                        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setReceiptData({
                          id: p.id, type: "payment", amount: Number(p.amount), commission: Number(p.commission || 0),
                          status: p.status, date: p.created_at, paymentMethod: getPaymentMethod(p.stripe_payment_id),
                          jobTitle: p.jobTitle, payerName: p.payerName, payeeName: p.payeeName,
                        })}>
                          <FileText className="w-3.5 h-3.5" /> View
                        </Button>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        {p.status === "failed" ? (
                          <Button size="sm" variant="outline" onClick={() => handleResetPayment(p.id)} disabled={resetting === p.id} className="gap-1.5">
                            <RotateCcw className={`w-3.5 h-3.5 ${resetting === p.id ? "animate-spin" : ""}`} />
                            {resetting === p.id ? "Resetting..." : "Reset"}
                          </Button>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">{t("No payments yet")}</p>
          <p className="text-sm text-muted-foreground">{t("Transaction records will appear here")}</p>
        </div>
      )}
      <TransactionReceipt open={!!receiptData} onClose={() => setReceiptData(null)} data={receiptData} />
    </div>
  );
}