import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function CustomerBookingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!user) return;
    const { data } = await supabase
      .from("jobs")
      .select("*, service_categories:category_id(name, icon)")
      .eq("customer_id", user.id)
      .in("status", ["accepted", "in_progress", "completed"])
      .order("created_at", { ascending: false });

    // Get worker names
    const workerIds = (data || []).map(j => j.worker_id).filter(Boolean);
    const { data: workerProfiles } = workerIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", workerIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (workerProfiles || []).forEach(p => { nameMap[p.id] = p.name; });

    // Check which jobs already have reviews
    const jobIds = (data || []).map(j => j.id);
    const { data: existingReviews } = jobIds.length > 0
      ? await supabase.from("reviews").select("job_id").eq("reviewer_id", user.id).in("job_id", jobIds)
      : { data: [] };
    const reviewedJobIds = new Set((existingReviews || []).map(r => r.job_id));

    setJobs((data || []).map(j => ({
      ...j,
      workerName: nameMap[j.worker_id] || "Assigned Worker",
      hasReview: reviewedJobIds.has(j.id),
    })));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [user]);

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

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 rounded-xl" /></div>;

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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Worker: {job.workerName} · {job.budget ? `$${job.budget}` : "Open"} · {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                {job.status === "completed" && !job.hasReview && (
                  <Button size="sm" variant="outline" onClick={() => setReviewDialog(job)} className="active:scale-[0.97]">
                    <Star className="w-4 h-4 mr-1" /> Review
                  </Button>
                )}
                {job.hasReview && (
                  <span className="text-xs text-green-500 flex items-center gap-1"><Star className="w-3 h-3 fill-current" /> Reviewed</span>
                )}
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
