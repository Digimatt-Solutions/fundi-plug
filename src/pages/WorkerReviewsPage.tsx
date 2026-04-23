import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function WorkerReviewsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avg, setAvg] = useState(0);
  const [copied, setCopied] = useState(false);

  const shareUrl = user ? `${window.location.origin}/reviews/${user.id}` : "";

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from("reviews")
        .select("*, jobs:job_id(title)")
        .eq("reviewee_id", user!.id)
        .order("created_at", { ascending: false });

      const all = data || [];
      const reviewerIds = [...new Set(all.map(r => r.reviewer_id))];
      const { data: profiles } = reviewerIds.length > 0
        ? await supabase.from("profiles").select("id, name, avatar_url").in("id", reviewerIds)
        : { data: [] };
      const pMap: Record<string, any> = {};
      (profiles || []).forEach(p => { pMap[p.id] = p; });

      const enriched = all.map(r => ({
        ...r,
        reviewerName: pMap[r.reviewer_id]?.name || "Client",
        reviewerAvatar: pMap[r.reviewer_id]?.avatar_url || null,
      }));
      setReviews(enriched);
      if (enriched.length) setAvg(Math.round(enriched.reduce((s, r) => s + r.rating, 0) / enriched.length * 10) / 10);
      setLoading(false);
    }
    load();
  }, [user]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My FundiPlug Reviews", text: "Check out my reviews on FundiPlug", url: shareUrl });
        return;
      } catch {}
    }
    handleCopy();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it on your socials" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Reviews</h1>
          <p className="text-muted-foreground text-sm">Feedback from clients</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>
          <Button size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-1.5" /> Share
          </Button>
        </div>
      </div>

      <div className="stat-card animate-fade-in p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <p className="text-4xl font-bold text-foreground tabular-nums">{avg > 0 ? avg : "-"}</p>
          <div>
            <div className="flex gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-5 h-5 ${s <= Math.round(avg) ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 break-all bg-muted/50 rounded p-2">{shareUrl}</p>
      </div>

      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((r, i) => (
            <div key={r.id} className="stat-card animate-fade-in p-4 sm:p-6" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-3">
                {r.reviewerAvatar ? (
                  <img loading="lazy" decoding="async" src={r.reviewerAvatar} alt={r.reviewerName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                    {r.reviewerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{r.reviewerName}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-0.5 my-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Job: {(r as any).jobs?.title || "-"}</p>
                </div>
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
