import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, TrendingUp, DollarSign, ArrowUpRight, ArrowDownCircle, Clock, CheckCircle, XCircle, FileText } from "lucide-react";
import TransactionReceipt, { getPaymentMethod } from "@/components/TransactionReceipt";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { friendlyError } from "@/lib/friendlyError";

type EarningsRange = "7d" | "30d" | "90d" | "12m" | "all";

export default function WorkerEarningsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [balance, setBalance] = useState(0);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [range, setRange] = useState<EarningsRange>("all");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const [paymentsRes, withdrawalsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("*, jobs:job_id(title)")
        .eq("payee_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("worker_id", user.id)
        .order("requested_at", { ascending: false }),
    ]);

    const all = paymentsRes.data || [];
    const allWithdrawals = withdrawalsRes.data || [];
    setPayments(all);
    setWithdrawals(allWithdrawals);

    const earned = all.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
    const pend = all.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
    const withdrawn = allWithdrawals
      .filter((w: any) => w.status === "completed" || w.status === "approved")
      .reduce((s: number, w: any) => s + Number(w.amount), 0);
    const pendingWithdrawals = allWithdrawals
      .filter((w: any) => w.status === "pending")
      .reduce((s: number, w: any) => s + Number(w.amount), 0);

    setTotal(earned);
    setPending(pend);
    setTotalWithdrawn(withdrawn);
    setBalance(earned - withdrawn - pendingWithdrawals);

    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const now = new Date();
    const buckets: { label: string; amount: number }[] = [];

    const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const fmtMonth = (d: Date) => d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

    if (range === "7d" || range === "30d") {
      const days = range === "7d" ? 7 : 30;
      const map: Record<string, number> = {};
      const order: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        map[key] = 0; order.push(key);
      }
      completed.forEach((p) => {
        const d = new Date(p.created_at); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        if (key in map) map[key] += Number(p.amount);
      });
      order.forEach((k) => buckets.push({ label: fmtDay(new Date(k)), amount: map[k] }));
    } else if (range === "90d") {
      const map: Record<string, number> = {};
      const order: string[] = [];
      for (let i = 12; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i * 7); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        map[key] = 0; order.push(key);
      }
      const startKeys = order.map((k) => new Date(k).getTime());
      completed.forEach((p) => {
        const t = new Date(p.created_at).getTime();
        for (let i = startKeys.length - 1; i >= 0; i--) {
          if (t >= startKeys[i]) { map[order[i]] += Number(p.amount); break; }
        }
      });
      order.forEach((k) => buckets.push({ label: fmtDay(new Date(k)), amount: map[k] }));
    } else if (range === "12m") {
      const map: Record<string, number> = {};
      const order: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        map[key] = 0; order.push(key);
      }
      completed.forEach((p) => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key in map) map[key] += Number(p.amount);
      });
      order.forEach((k) => {
        const [y, m] = k.split("-").map(Number);
        buckets.push({ label: fmtMonth(new Date(y, m, 1)), amount: map[k] });
      });
    } else {
      if (completed.length === 0) {
        buckets.push({ label: fmtMonth(now), amount: 0 });
      } else {
        const sorted = [...completed].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const first = new Date(sorted[0].created_at);
        const map: Record<string, number> = {};
        const order: string[] = [];
        const cur = new Date(first.getFullYear(), first.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        while (cur <= end) {
          const key = `${cur.getFullYear()}-${cur.getMonth()}`;
          map[key] = 0; order.push(key);
          cur.setMonth(cur.getMonth() + 1);
        }
        completed.forEach((p) => {
          const d = new Date(p.created_at);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (key in map) map[key] += Number(p.amount);
        });
        order.forEach((k) => {
          const [y, m] = k.split("-").map(Number);
          buckets.push({ label: fmtMonth(new Date(y, m, 1)), amount: map[k] });
        });
      }
    }
    setWeeklyData(buckets);
  }, [payments, range]);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || amount > balance) {
      toast({ title: "Invalid amount", description: `Enter a value between 1 and ${balance.toLocaleString()}`, variant: "destructive" });
      return;
    }
    setWithdrawing(true);
    try {
      const { error } = await supabase.from("withdrawals").insert({
        worker_id: user!.id,
        amount,
      });
      if (error) throw error;
      toast({ title: "Withdrawal requested", description: `KSH ${amount.toLocaleString()} withdrawal is pending admin approval.` });
      setWithdrawAmount("");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Request failed", description: friendlyError(err), variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-primary" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-chart-4" />;
  };

  const statusColor = (status: string) => {
    if (status === "completed") return "bg-green-500/10 text-green-500";
    if (status === "approved") return "bg-primary/10 text-primary";
    if (status === "rejected") return "bg-destructive/10 text-destructive";
    return "bg-chart-4/10 text-chart-4";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
          <p className="text-muted-foreground text-sm">Track your income and request withdrawals</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={balance <= 0} className="gap-2">
              <ArrowDownCircle className="w-4 h-4" />
              Request Withdrawal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Withdrawal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-foreground">KSH {balance.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Amount to withdraw</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  max={balance}
                  min={1}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-3xl font-bold text-foreground tabular-nums">KSH {total.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
        <div className="stat-card animate-fade-in" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold text-green-500 tabular-nums">KSH {balance.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
        <div className="stat-card animate-fade-in" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Withdrawn</p>
              <p className="text-3xl font-bold text-foreground tabular-nums">KSH {totalWithdrawn.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <ArrowDownCircle className="w-6 h-6 text-chart-4" />
            </div>
          </div>
        </div>
        <div className="stat-card animate-fade-in" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-3xl font-bold text-foreground tabular-nums">{payments.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-chart-2" />
            </div>
          </div>
        </div>
      </div>

      <div className="stat-card animate-fade-in" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-foreground">Earnings Over Time</h2>
          <Select value={range} onValueChange={(v) => setRange(v as EarningsRange)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={weeklyData}>
            <defs>
              <linearGradient id="earnGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
            <Area type="monotone" dataKey="amount" stroke="hsl(22, 93%, 49%)" fill="url(#earnGrad2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="stat-card animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h2 className="text-lg font-semibold text-foreground mb-4">Withdrawal History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Requested</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Processed</th>
                   <th className="text-left p-4 text-muted-foreground font-medium">Notes</th>
                   <th className="text-left p-4 text-muted-foreground font-medium">Receipt</th>
                 </tr>
               </thead>
              <tbody>
                {withdrawals.map((w: any) => (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-4 text-foreground font-medium tabular-nums">KSH {Number(w.amount).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs capitalize ${statusColor(w.status)}`}>
                        {statusIcon(w.status)}
                        {w.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{new Date(w.requested_at).toLocaleString()}</td>
                    <td className="p-4 text-muted-foreground text-xs">{w.processed_at ? new Date(w.processed_at).toLocaleString() : "-"}</td>
                     <td className="p-4 text-muted-foreground text-xs">{w.admin_notes || "-"}</td>
                     <td className="p-4">
                       {w.status === "completed" && (
                         <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setReceiptData({
                           id: w.id, type: "withdrawal", amount: Number(w.amount), status: w.status,
                           date: w.processed_at || w.requested_at, workerName: user?.name, adminNotes: w.admin_notes,
                         })}>
                           <FileText className="w-3.5 h-3.5" /> View
                         </Button>
                       )}
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 ? (
        <div className="stat-card overflow-hidden p-0 animate-fade-in" style={{ animationDelay: "500ms" }}>
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 text-muted-foreground font-medium">Job</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Amount</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-4 text-foreground">{(p as any).jobs?.title || "-"}</td>
                  <td className="p-4 text-foreground tabular-nums">KSH {Number(p.amount).toLocaleString()}</td>
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
                        jobTitle: (p as any).jobs?.title || "-", payeeName: user?.name,
                      })}>
                        <FileText className="w-3.5 h-3.5" /> View
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No earnings yet</p>
          <p className="text-sm text-muted-foreground">Complete jobs to start earning</p>
        </div>
      )}
      <TransactionReceipt open={!!receiptData} onClose={() => setReceiptData(null)} data={receiptData} />
    </div>
  );
}
