import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownCircle, CheckCircle, XCircle, Clock, Search, FileText } from "lucide-react";
import TransactionReceipt from "@/components/TransactionReceipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function AdminDisbursementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [workerFinancials, setWorkerFinancials] = useState<Record<string, { earned: number; withdrawn: number; pending: number }>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [actionDialog, setActionDialog] = useState<{ withdrawal: any; action: "approve" | "reject" | "complete" } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const { data: wds } = await supabase
      .from("withdrawals")
      .select("*")
      .order("requested_at", { ascending: false });

    const workerIds = [...new Set((wds || []).map((w: any) => w.worker_id))];
    const { data: profiles } = workerIds.length > 0
      ? await supabase.from("profiles").select("id, name, email, phone").in("id", workerIds)
      : { data: [] };
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // Fetch earnings for each worker
    const { data: payments } = workerIds.length > 0
      ? await supabase.from("payments").select("payee_id, amount, commission, status").eq("status", "completed").in("payee_id", workerIds)
      : { data: [] };

    const financials: Record<string, { earned: number; withdrawn: number; pending: number }> = {};
    workerIds.forEach(id => { financials[id] = { earned: 0, withdrawn: 0, pending: 0 }; });

    (payments || []).forEach((p: any) => {
      if (financials[p.payee_id]) {
        financials[p.payee_id].earned += Number(p.amount) - Number(p.commission || 0);
      }
    });

    (wds || []).forEach((w: any) => {
      if (financials[w.worker_id]) {
        if (w.status === "completed" || w.status === "approved") {
          financials[w.worker_id].withdrawn += Number(w.amount);
        } else if (w.status === "pending") {
          financials[w.worker_id].pending += Number(w.amount);
        }
      }
    });

    setWorkerFinancials(financials);
    setWithdrawals((wds || []).map((w: any) => ({
      ...w,
      workerName: profileMap[w.worker_id]?.name || "Unknown",
      workerEmail: profileMap[w.worker_id]?.email || "",
      workerPhone: profileMap[w.worker_id]?.phone || "",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setProcessing(true);
    const { withdrawal, action } = actionDialog;
    try {
      const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "completed";
      const { error } = await supabase
        .from("withdrawals")
        .update({
          status: newStatus,
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
          processed_by: user!.id,
        })
        .eq("id", withdrawal.id);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        user_id: user!.id,
        action: `Withdrawal ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        detail: `${newStatus} withdrawal of KSH ${Number(withdrawal.amount).toLocaleString()} for ${withdrawal.workerName}`,
        entity_type: "withdrawal",
        entity_id: withdrawal.id,
      });

      toast({ title: `Withdrawal ${newStatus}`, description: `KSH ${Number(withdrawal.amount).toLocaleString()} request has been ${newStatus}.` });
      setActionDialog(null);
      setAdminNotes("");
      load();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const stats = {
    pending: withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0),
    pendingCount: withdrawals.filter(w => w.status === "pending").length,
    approved: withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + Number(w.amount), 0),
    completed: withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0),
    total: withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0),
  };

  const filtered = withdrawals.filter(w => {
    if (filter !== "all" && w.status !== filter) return false;
    const q = search.toLowerCase();
    return !q || w.workerName.toLowerCase().includes(q) || w.workerEmail.toLowerCase().includes(q);
  });

  const statusColor = (status: string) => {
    if (status === "completed") return "bg-green-500/10 text-green-500";
    if (status === "approved") return "bg-primary/10 text-primary";
    if (status === "rejected") return "bg-destructive/10 text-destructive";
    return "bg-chart-4/10 text-chart-4";
  };

  const getWorkerBalance = (workerId: string) => {
    const f = workerFinancials[workerId];
    if (!f) return { earned: 0, balance: 0 };
    return { earned: Math.round(f.earned), balance: Math.round(f.earned - f.withdrawn - f.pending) };
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Disbursements</h1>
        <p className="text-muted-foreground text-sm">Manage worker withdrawal requests</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
              <p className="text-3xl font-bold text-chart-4 tabular-nums">{stats.pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">KSH {stats.pending.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-chart-4" />
            </div>
          </div>
        </div>
        <div className="stat-card animate-fade-in" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Awaiting Disbursement</p>
              <p className="text-3xl font-bold text-primary tabular-nums">KSH {stats.approved.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ArrowDownCircle className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
        <div className="stat-card animate-fade-in" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Disbursed</p>
              <p className="text-3xl font-bold text-green-500 tabular-nums">KSH {stats.total.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by worker name..." className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {["all", "pending", "approved", "completed", "rejected"].map(s => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize text-xs">
              {s}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="stat-card overflow-hidden p-0 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Worker</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Earnings</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Balance</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Requested</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w: any) => {
                  const { earned, balance } = getWorkerBalance(w.worker_id);
                  return (
                    <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <p className="text-foreground font-medium">{w.workerName}</p>
                        <p className="text-xs text-muted-foreground">{w.workerPhone || w.workerEmail}</p>
                      </td>
                      <td className="p-4 text-foreground font-semibold tabular-nums">KSH {Number(w.amount).toLocaleString()}</td>
                      <td className="p-4 text-muted-foreground tabular-nums text-xs">KSH {earned.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`font-semibold tabular-nums text-xs ${balance > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                          KSH {balance.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${statusColor(w.status)}`}>{w.status}</span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">{new Date(w.requested_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex gap-1.5">
                          {w.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="text-xs gap-1 border-green-500/30 text-green-500 hover:bg-green-500/10"
                                onClick={() => { setActionDialog({ withdrawal: w, action: "approve" }); setAdminNotes(""); }}>
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => { setActionDialog({ withdrawal: w, action: "reject" }); setAdminNotes(""); }}>
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </Button>
                            </>
                          )}
                          {w.status === "approved" && (
                            <Button size="sm" className="text-xs gap-1"
                              onClick={() => { setActionDialog({ withdrawal: w, action: "complete" }); setAdminNotes(""); }}>
                              <CheckCircle className="w-3.5 h-3.5" /> Mark Sent
                            </Button>
                          )}
                          {w.status === "completed" && (
                            <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setReceiptData({
                              id: w.id, type: "withdrawal", amount: Number(w.amount), status: w.status,
                              date: w.processed_at || w.requested_at, workerName: w.workerName,
                              phone: w.workerPhone, adminNotes: w.admin_notes,
                            })}>
                              <FileText className="w-3.5 h-3.5" /> Receipt
                            </Button>
                          )}
                          {w.status === "rejected" && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <ArrowDownCircle className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No withdrawal requests</p>
          <p className="text-sm text-muted-foreground">Worker withdrawal requests will appear here</p>
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionDialog?.action === "complete" ? "Mark as Sent" : actionDialog?.action} Withdrawal
            </DialogTitle>
          </DialogHeader>
          {actionDialog && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm text-muted-foreground">Worker: <span className="text-foreground font-medium">{actionDialog.withdrawal.workerName}</span></p>
                <p className="text-sm text-muted-foreground">Amount: <span className="text-foreground font-bold">KSH {Number(actionDialog.withdrawal.amount).toLocaleString()}</span></p>
                {actionDialog.withdrawal.workerPhone && (
                  <p className="text-sm text-muted-foreground">Phone: <span className="text-foreground">{actionDialog.withdrawal.workerPhone}</span></p>
                )}
                {(() => {
                  const { earned, balance } = getWorkerBalance(actionDialog.withdrawal.worker_id);
                  return (
                    <>
                      <p className="text-sm text-muted-foreground">Total Earnings: <span className="text-foreground">KSH {earned.toLocaleString()}</span></p>
                      <p className="text-sm text-muted-foreground">Available Balance: <span className={`font-bold ${balance > 0 ? "text-green-500" : "text-destructive"}`}>KSH {balance.toLocaleString()}</span></p>
                    </>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <Textarea placeholder="Add notes about this disbursement..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleAction} disabled={processing}
              variant={actionDialog?.action === "reject" ? "destructive" : "default"}>
              {processing ? "Processing..." : actionDialog?.action === "complete" ? "Confirm Sent" : actionDialog?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TransactionReceipt open={!!receiptData} onClose={() => setReceiptData(null)} data={receiptData} />
    </div>
  );
}
