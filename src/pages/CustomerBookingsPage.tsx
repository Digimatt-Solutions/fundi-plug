import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Star, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSearchParams } from "react-router-dom";

export default function CustomerBookingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [payDialog, setPayDialog] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);

  async function loadData() {
    if (!user) return;
    const { data } = await supabase
      .from("jobs")
      .select("*, service_categories:category_id(name, icon)")
      .eq("customer_id", user.id)
      .in("status", ["accepted", "in_progress", "completed"])
      .order("created_at", { ascending: false });

    const workerIds = (data || []).map(j => j.worker_id).filter(Boolean);
    const { data: workerProfiles } = workerIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", workerIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (workerProfiles || []).forEach(p => { nameMap[p.id] = p.name; });

    const jobIds = (data || []).map(j => j.id);
    const [existingReviews, existingPayments] = await Promise.all([
      jobIds.length > 0
        ? supabase.from("reviews").select("job_id").eq("reviewer_id", user.id).in("job_id", jobIds)
        : Promise.resolve({ data: [] }),
      jobIds.length > 0
        ? supabase.from("payments").select("job_id, status").in("job_id", jobIds)
        : Promise.resolve({ data: [] }),
    ]);

    const reviewedJobIds = new Set((existingReviews.data || []).map(r => r.job_id));
    const paidJobMap: Record<string, string> = {};
    (existingPayments.data || []).forEach(p => { paidJobMap[p.job_id] = p.status; });

    setJobs((data || []).map(j => ({
      ...j,
      workerName: nameMap[j.worker_id] || "Assigned Worker",
      hasReview: reviewedJobIds.has(j.id),
      paymentStatus: paidJobMap[j.id] || null,
    })));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const paymentId = searchParams.get("payment_id");
    if (paymentStatus === "success" && paymentId) {
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.functions.invoke("verify-payment", {
          body: { paymentId },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        toast({ title: "Payment successful!", description: "Your payment has been processed." });
        loadData();
      })();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && jobs.length > 0) {
      const unpaid = jobs.find(j => j.status === "completed" && (!j.paymentStatus || j.paymentStatus === "pending"));
      if (unpaid && !payDialog) setPayDialog(unpaid);
    }
  }, [jobs, loading]);

  const handlePay = async (job: any) => {
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { jobId: job.id, amount: job.budget || 50, workerId: job.worker_id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const submitReview = async () => {
    if (!reviewDialog || !user) return;
    setSubmitting(true);
    await supabase.from("reviews").insert({
      job_id: reviewDialog.id, reviewer_id: user.id,
      reviewee_id: reviewDialog.worker_id, rating, comment: comment || null,
    });
    toast({ title: "Review submitted!" });
    setReviewDialog(null); setRating(5); setComment("");
    setSubmitting(false); loadData();
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
        <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
        <p className="text-muted-foreground text-sm">Track your active and completed bookings</p>
      </div>

      {jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job, i) => (
            <div key={job.id} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span>{(job as any).service_categories?.icon || "🔧"}</span>
                    <h3 className="font-semibold text-foreground">{job.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      job.status === "completed" ? "bg-green-500/10 text-green-500" :
                      job.status === "in_progress" ? "bg-primary/10 text-primary" :
                      "bg-chart-4/10 text-chart-4"
                    }`}>{job.status.replace("_", " ")}</span>
                    {job.paymentStatus && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        job.paymentStatus === "completed" ? "bg-green-500/10 text-green-500" :
                        job.paymentStatus === "pending" ? "bg-chart-4/10 text-chart-4" : ""
                      }`}>💰 {job.paymentStatus}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Worker: {job.workerName} - KSH {job.budget ? job.budget.toLocaleString() : "Open"} - {new Date(job.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {job.status === "completed" && (!job.paymentStatus || job.paymentStatus === "pending") && (
                    <Button size="sm" onClick={() => handlePay(job)} className="active:scale-[0.97]">
                      <CreditCard className="w-4 h-4 mr-1" /> Pay Now
                    </Button>
                  )}
                  {job.status === "completed" && job.paymentStatus === "completed" && !job.hasReview && (
                    <Button size="sm" variant="outline" onClick={() => setReviewDialog(job)} className="active:scale-[0.97]">
                      <Star className="w-4 h-4 mr-1" /> Review
                    </Button>
                  )}
                  {job.hasReview && (
                    <span className="text-xs text-green-500 flex items-center gap-1"><Star className="w-3 h-3 fill-current" /> Reviewed</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <CalendarDays className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No bookings yet</p>
          <p className="text-sm text-muted-foreground">When you hire a worker, your bookings will appear here</p>
        </div>
      )}

      <Dialog open={!!payDialog} onOpenChange={(open) => !open && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment Required</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The service for <strong className="text-foreground">{payDialog?.title}</strong> has been completed by <strong className="text-foreground">{payDialog?.workerName}</strong>.
            </p>
            <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount Due</span>
              <span className="text-2xl font-bold text-foreground">KSH {payDialog?.budget || 50}</span>
            </div>
            <p className="text-xs text-muted-foreground">A platform commission will be deducted. The worker receives the net amount.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Later</Button>
            <Button onClick={() => { setPayDialog(null); handlePay(payDialog); }} disabled={paying}>
              <CreditCard className="w-4 h-4 mr-2" /> {paying ? "Processing..." : "Pay Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewDialog} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rate Worker</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} className="p-1">
                  <Star className={`w-8 h-8 transition-colors ${s <= rating ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a comment..." className="bg-muted/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={submitting}>{submitting ? "Submitting..." : "Submit Review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}