import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";

export default function WorkerReviewsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avg, setAvg] = useState(0);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from("reviews")
        .select("*, jobs:job_id(title)")
        .eq("reviewee_id", user!.id)
        .order("created_at", { ascending: false });

      const all = data || [];

      // Fetch reviewer names
      const reviewerIds = [...new Set(all.map(r => r.reviewer_id))];
      const { data: profiles } = reviewerIds.length > 0
        ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
        : { data: [] };
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

      const enriched = all.map(r => ({ ...r, reviewerName: nameMap[r.reviewer_id] || "Client" }));
      setReviews(enriched);
      if (enriched.length) setAvg(Math.round(enriched.reduce((s, r) => s + r.rating, 0) / enriched.length * 10) / 10);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Reviews</h1>
        <p className="text-muted-foreground text-sm">Feedback from clients</p>
      </div>

      <div className="stat-card animate-fade-in">
        <div className="flex items-center gap-4">
          <p className="text-4xl font-bold text-foreground tabular-nums">{avg > 0 ? avg : "—"}</p>
          <div>
            <div className="flex gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-5 h-5 ${s <= Math.round(avg) ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((r, i) => (
            <div key={r.id} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-foreground">{r.reviewerName}</span>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Job: {(r as any).jobs?.title || "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <Star className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No reviews yet</p>
          <p className="text-sm text-muted-foreground">Complete jobs to receive reviews from clients</p>
        </div>
      )}
    </div>
  );
}
