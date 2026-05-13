import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";
import logo from "@/assets/logo.png";
import cover from "@/assets/fundiplug-cover.jpg";

export default function PublicReviewsPage() {
  const { workerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avg, setAvg] = useState(0);
  const [worker, setWorker] = useState<any>(null);

  useEffect(() => {
    if (!workerId) return;
    async function load() {
      const [{ data: profile }, { data: revs }] = await Promise.all([
        supabase.from("profiles").select("id, name, avatar_url").eq("id", workerId!).maybeSingle(),
        supabase.from("reviews").select("*, jobs:job_id(title)").eq("reviewee_id", workerId!).order("created_at", { ascending: false }),
      ]);
      setWorker(profile);
      const all = revs || [];
      const reviewerIds = [...new Set(all.map((r: any) => r.reviewer_id))];
      const { data: profiles } = reviewerIds.length > 0
        ? await supabase.from("profiles").select("id, name, avatar_url").in("id", reviewerIds)
        : { data: [] };
      const pMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { pMap[p.id] = p; });
      const enriched = all.map((r: any) => ({
        ...r,
        reviewerName: pMap[r.reviewer_id]?.name || "Client",
        reviewerAvatar: pMap[r.reviewer_id]?.avatar_url || null,
      }));
      setReviews(enriched);
      if (enriched.length) setAvg(Math.round(enriched.reduce((s, r) => s + r.rating, 0) / enriched.length * 10) / 10);
      setLoading(false);
    }
    load();
  }, [workerId]);

  // SEO: per-page title, description, canonical, og:*, structured data
  useEffect(() => {
    if (!worker) return;
    const url = window.location.href;
    document.title = `${worker.name} - Reviews | FundiPlug`;
    const desc = `${reviews.length} client reviews for ${worker.name} on FundiPlug. Average rating ${avg || "-"}/5.`;

    function setMeta(selector: string, attr: string, key: string, content: string) {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(selector.startsWith("link") ? "link" : "meta") as any;
        el!.setAttribute(attr, key);
        document.head.appendChild(el!);
      }
      el!.setAttribute(selector.startsWith("link") ? "href" : "content", content);
    }
    setMeta('meta[name="description"]', "name", "description", desc);
    setMeta('link[rel="canonical"]', "rel", "canonical", url);
    setMeta('meta[property="og:title"]', "property", "og:title", `${worker.name} - Reviews | FundiPlug`);
    setMeta('meta[property="og:description"]', "property", "og:description", desc);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    setMeta('meta[property="og:type"]', "property", "og:type", "profile");
    if (worker.avatar_url) setMeta('meta[property="og:image"]', "property", "og:image", worker.avatar_url);

    // JSON-LD ProfilePage + Reviews
    const ld = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: {
        "@type": "Person",
        name: worker.name,
        image: worker.avatar_url || undefined,
        aggregateRating: reviews.length ? {
          "@type": "AggregateRating",
          ratingValue: avg,
          reviewCount: reviews.length,
        } : undefined,
        review: reviews.slice(0, 10).map((r: any) => ({
          "@type": "Review",
          author: { "@type": "Person", name: r.reviewerName || "Client" },
          reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
          reviewBody: r.comment || undefined,
          datePublished: r.created_at,
        })),
      },
    };
    let script = document.getElementById("ld-profile") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "ld-profile";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);

    return () => {
      script?.remove();
    };
  }, [worker, reviews, avg]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center gap-3 p-4">
          <img loading="lazy" decoding="async" src={logo} alt="FundiPlug" className="w-8 h-8 rounded" />
          <span className="font-bold text-primary">FundiPlug</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <section className="stat-card flex items-center gap-4">
          {worker?.avatar_url ? (
            <img loading="lazy" decoding="async" src={worker.avatar_url} alt={worker.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              {(worker?.name || "F").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{worker?.name || "Fundi"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(avg) ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
                ))}
              </div>
              <span className="text-sm font-semibold text-foreground">{avg > 0 ? avg : "-"}</span>
              <span className="text-xs text-muted-foreground">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          </div>
        </section>

        {reviews.length > 0 ? (
          <section className="space-y-3" aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="text-lg font-semibold text-foreground">Client Reviews</h2>
            {reviews.map((r) => (
              <article key={r.id} className="stat-card">
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
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
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
              </article>
            ))}
          </section>
        ) : (
          <div className="stat-card flex flex-col items-center py-12 text-center">
            <Star className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-foreground font-medium">No reviews yet</p>
          </div>
        )}

        {/* Marketing banner */}
        <section aria-labelledby="cta-heading">
          <h2 id="cta-heading" className="sr-only">Discover more skilled fundis on FundiPlug</h2>
          <a href="/" aria-label="Visit FundiPlug" className="block group">
          <img
            src={cover}
            alt="Connect with skilled fundis you can rely on - FundiPlug"
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl border border-border shadow-sm transition-transform group-hover:scale-[1.01]"
          />
          </a>
        </section>

        <footer className="text-center py-6 text-xs text-muted-foreground">
          Powered by <a href="/" className="text-primary hover:underline">FundiPlug</a> - © Digimatt Solutions 2026
        </footer>
      </main>
    </div>
  );
}
