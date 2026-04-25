import { useEffect, useState } from "react";
import { MessageSquareWarning, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { friendlyError } from "@/lib/friendlyError";

export default function CustomerComplaintsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [jobsRes, complaintsRes] = await Promise.all([
        supabase.from("jobs").select("id, title, worker_id, profiles!jobs_worker_id_fkey(name)").eq("customer_id", user!.id).not("worker_id", "is", null),
        supabase.from("complaints").select("*, profiles:fundi_id(name), jobs:job_id(title)").eq("customer_id", user!.id).order("created_at", { ascending: false }),
      ]);
      setJobs(jobsRes.data || []);
      setComplaints(complaintsRes.data || []);
      setLoading(false);
    }
    load();
  }, [user]);

  const submit = async () => {
    if (!selectedJobId || !message.trim()) {
      toast({ title: "Please select a job and enter your complaint", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const job = jobs.find(j => j.id === selectedJobId);
    const { error } = await supabase.from("complaints").insert({
      customer_id: user!.id,
      fundi_id: job.worker_id,
      job_id: selectedJobId,
      message: message.trim(),
    } as any);
    if (error) {
      toast({ title: "Failed to submit", description: friendlyError(error), variant: "destructive" });
    } else {
      toast({ title: "Complaint submitted", description: "Admin will review and respond." });
      setMessage("");
      setSelectedJobId("");
      const { data } = await supabase.from("complaints").select("*, profiles:fundi_id(name), jobs:job_id(title)").eq("customer_id", user!.id).order("created_at", { ascending: false });
      setComplaints(data || []);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("Complaints")}</h1>
        <p className="text-muted-foreground text-sm">{t("Report issues with a fundi or completed job")}</p>
      </div>

      <div className="stat-card space-y-4 animate-fade-in">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-primary" /> New Complaint
        </h3>
        <div className="space-y-2">
          <Label>{t("Select Job & Fundi")}</Label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="bg-muted/50"><SelectValue placeholder={t("Select a job...")} /></SelectTrigger>
            <SelectContent>
              {jobs.map(j => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title} - {(j as any).profiles?.name || "Fundi"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("Describe your complaint")}</Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t("Describe the issue in detail...")} className="bg-muted/50 min-h-[100px]" />
        </div>
        <Button onClick={submit} disabled={submitting || !selectedJobId || !message.trim()} className="gap-2">
          <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Complaint"}
        </Button>
      </div>

      <div className="space-y-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <h3 className="text-lg font-semibold text-foreground">{t("My Complaints")}</h3>
        {complaints.length === 0 ? (
          <div className="stat-card text-center py-12 text-muted-foreground text-sm">{t("No complaints submitted yet.")}</div>
        ) : (
          complaints.map(c => (
            <div key={c.id} className="stat-card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{(c as any).jobs?.title || "Job"}</p>
                  <p className="text-xs text-muted-foreground">Fundi: {(c as any).profiles?.name || "-"} · {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${c.status === "open" ? "bg-chart-4/10 text-chart-4" : c.status === "resolved" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                  {c.status}
                </span>
              </div>
              <p className="text-sm text-foreground">{c.message}</p>
              {c.admin_reply && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs font-medium text-primary mb-1">{t("Admin Response:")}</p>
                  <p className="text-sm text-foreground">{c.admin_reply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
