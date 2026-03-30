import { useEffect, useState } from "react";
import { Check, X, FileText, Clock, Eye, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function VerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDocs, setViewDocs] = useState<any>(null);
  const [certs, setCerts] = useState<any[]>([]);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from("worker_profiles")
      .select("*, profiles:user_id(name, email, avatar_url), certifications(id, name, file_url)")
      .order("created_at", { ascending: false });
    setWorkers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const channel = supabase.channel("verification-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAction = async (workerId: string, action: "approved" | "rejected") => {
    await supabase.from("worker_profiles").update({ verification_status: action }).eq("id", workerId);
    await supabase.from("activity_logs").insert({
      user_id: user!.id,
      action: action === "approved" ? "Worker Approved" : "Worker Rejected",
      detail: `Worker ${action}`, entity_type: "worker_profile", entity_id: workerId,
    });
    toast({ title: `Worker ${action}` });
    loadAll();
  };

  const viewDocuments = (worker: any) => {
    setViewDocs(worker);
    setCerts(worker.certifications || []);
  };

  const pending = workers.filter(w => w.verification_status === "pending");
  const approved = workers.filter(w => w.verification_status === "approved");
  const rejected = workers.filter(w => w.verification_status === "rejected");

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">Rejected</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">Pending</Badge>;
  };

  const renderWorkerCard = (w: any, i: number, showActions: boolean) => (
    <div key={w.id} className="rounded-xl border bg-card p-4 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm overflow-hidden">
            {w.profiles?.avatar_url
              ? <img src={w.profiles.avatar_url} className="w-full h-full object-cover rounded-full" />
              : (w.profiles?.name || "W").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground text-sm">{w.profiles?.name || "Unknown"}</p>
              {statusBadge(w.verification_status)}
            </div>
            <p className="text-xs text-muted-foreground">{w.profiles?.email}</p>
            {w.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{w.bio}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {(w.certifications || []).length} docs</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(w.created_at).toLocaleDateString()}</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => viewDocuments(w)}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
            {showActions && w.verification_status !== "approved" && (
              <Button size="sm" className="h-8 text-xs" onClick={() => handleAction(w.id, "approved")}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>
            )}
            {showActions && w.verification_status !== "rejected" && (
              <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleAction(w.id, "rejected")}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const emptyState = (icon: React.ReactNode, title: string, sub: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="text-foreground font-medium mt-2">{title}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Worker Verification</h1>
        <p className="text-muted-foreground text-sm">Review and manage worker verification status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-2xl font-bold text-foreground">{pending.length}</p><p className="text-xs text-muted-foreground">Pending Review</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-green-500" /></div>
          <div><p className="text-2xl font-bold text-foreground">{approved.length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><ShieldX className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-2xl font-bold text-foreground">{rejected.length}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pending" className="gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Approved ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            <ShieldX className="w-4 h-4" /> Rejected ({rejected.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length > 0
            ? pending.map((w, i) => renderWorkerCard(w, i, true))
            : emptyState(<Check className="w-10 h-10 text-green-500" />, "All caught up!", "No pending verifications")}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3 mt-4">
          {approved.length > 0
            ? approved.map((w, i) => renderWorkerCard(w, i, true))
            : emptyState(<ShieldCheck className="w-10 h-10 text-muted-foreground" />, "No approved workers yet", "Approve pending workers to see them here")}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-3 mt-4">
          {rejected.length > 0
            ? rejected.map((w, i) => renderWorkerCard(w, i, true))
            : emptyState(<ShieldX className="w-10 h-10 text-muted-foreground" />, "No rejected workers", "Rejected workers will appear here")}
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewDocs} onOpenChange={(o) => !o && setViewDocs(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Worker Documents - {viewDocs?.profiles?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Bio</p><p className="text-foreground">{viewDocs?.bio || "Not provided"}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Rate</p><p className="text-foreground">{viewDocs?.hourly_rate ? `KSH ${viewDocs.hourly_rate}/hr` : "-"}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Experience</p><p className="text-foreground">{viewDocs?.years_experience || 0} years</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Area</p><p className="text-foreground">{viewDocs?.service_area || "-"}</p></div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Uploaded Documents ({certs.length})</h4>
              {certs.length > 0 ? certs.map((cert: any) => (
                <div key={cert.id} className="flex items-center justify-between p-2 rounded bg-muted/50 mb-1">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /><span className="text-sm">{cert.name}</span></div>
                  {cert.file_url && <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View File</a>}
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
