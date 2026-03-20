import { useEffect, useState } from "react";
import { Check, X, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function VerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPending() {
    const { data } = await supabase
      .from("worker_profiles")
      .select("*, profiles:user_id(name, email), certifications(id)")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false });
    setWorkers(data || []);
    setLoading(false);
  }

  useEffect(() => { loadPending(); }, []);

  const handleAction = async (workerId: string, userId: string, action: "approved" | "rejected") => {
    await supabase.from("worker_profiles").update({ verification_status: action }).eq("id", workerId);
    await supabase.from("activity_logs").insert({
      user_id: user!.id,
      action: action === "approved" ? "Worker Approved" : "Worker Rejected",
      detail: `Worker ${action}`,
      entity_type: "worker_profile",
      entity_id: workerId,
    });
    toast({ title: `Worker ${action}` });
    loadPending();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Worker Verification</h1>
        <p className="text-muted-foreground text-sm">Review and approve worker applications</p>
      </div>

      {workers.length > 0 ? (
        <div className="space-y-4">
          {workers.map((w, i) => (
            <div key={w.id} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {((w as any).profiles?.name || "W").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{(w as any).profiles?.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{(w as any).profiles?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" /> {(w.certifications || []).length} documents
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" /> {new Date(w.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="active:scale-[0.97]" onClick={() => handleAction(w.id, w.user_id, "approved")}>
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 active:scale-[0.97]" onClick={() => handleAction(w.id, w.user_id, "rejected")}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <Check className="w-12 h-12 text-green-500 mb-3" />
          <p className="text-foreground font-medium">All caught up!</p>
          <p className="text-sm text-muted-foreground">No pending worker verifications</p>
        </div>
      )}
    </div>
  );
}
