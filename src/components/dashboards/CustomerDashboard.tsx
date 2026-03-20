import { useEffect, useState } from "react";
import { Search, MapPin, Star, Zap, CalendarDays, CreditCard, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [nearbyWorkers, setNearbyWorkers] = useState<any[]>([]);
  const [stats, setStats] = useState({ bookings: 0, spent: 0, avgRating: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      // Categories with worker counts
      const { data: cats } = await supabase.from("service_categories").select("*");
      const { data: workers } = await supabase.from("worker_profiles").select("skills");
      const skillCounts: Record<string, number> = {};
      (workers || []).forEach(w => {
        (w.skills || []).forEach((s: string) => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
      });
      setCategories((cats || []).map(c => ({ ...c, count: skillCounts[c.id] || 0 })));

      // Nearby online workers
      const { data: onlineWorkers } = await supabase
        .from("worker_profiles")
        .select("*, profiles!worker_profiles_user_id_fkey(name, avatar_url)")
        .eq("verification_status", "approved")
        .limit(8);

      const workerIds = (onlineWorkers || []).map(w => w.user_id);
      const { data: reviewsData } = workerIds.length > 0
        ? await supabase.from("reviews").select("reviewee_id, rating").in("reviewee_id", workerIds)
        : { data: [] };

      const ratingMap: Record<string, { sum: number; count: number }> = {};
      (reviewsData || []).forEach(r => {
        if (!ratingMap[r.reviewee_id]) ratingMap[r.reviewee_id] = { sum: 0, count: 0 };
        ratingMap[r.reviewee_id].sum += r.rating;
        ratingMap[r.reviewee_id].count += 1;
      });

      // Get skill names
      const skillIds = [...new Set((onlineWorkers || []).flatMap(w => w.skills || []))];
      const { data: skillNames } = skillIds.length > 0
        ? await supabase.from("service_categories").select("id, name").in("id", skillIds)
        : { data: [] };
      const skillMap: Record<string, string> = {};
      (skillNames || []).forEach(s => { skillMap[s.id] = s.name; });

      setNearbyWorkers((onlineWorkers || []).map(w => ({
        ...w,
        name: (w as any).profiles?.name || "Worker",
        skill: (w.skills || []).map((s: string) => skillMap[s] || "").filter(Boolean).join(", ") || "General",
        rating: ratingMap[w.user_id] ? Math.round(ratingMap[w.user_id].sum / ratingMap[w.user_id].count * 10) / 10 : 0,
        available: w.is_online,
      })));

      // Customer stats
      const [bookingsRes, paymentsRes, givenReviews] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("customer_id", user!.id),
        supabase.from("payments").select("amount").eq("payer_id", user!.id).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("reviewer_id", user!.id),
      ]);
      const totalSpent = (paymentsRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
      const reviews = givenReviews.data || [];
      const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

      setStats({ bookings: bookingsRes.count ?? 0, spent: totalSpent, avgRating: Math.round(avg * 10) / 10 });
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-14 max-w-2xl rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Find Skilled Workers</h1>
        <p className="text-muted-foreground text-sm">Book trusted professionals near you</p>
      </div>

      <div className="relative max-w-2xl animate-fade-in">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input placeholder="What service do you need?" className="pl-12 h-14 text-base bg-card border-border rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-lg animate-fade-in" style={{ animationDelay: "100ms" }}>
        <Button variant="outline" className="h-14 justify-start gap-3 bg-primary/5 border-primary/20 hover:bg-primary/10 text-foreground">
          <Zap className="w-5 h-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium">Instant Service</p>
            <p className="text-xs text-muted-foreground">Request now</p>
          </div>
        </Button>
        <Button variant="outline" className="h-14 justify-start gap-3 bg-card border-border hover:bg-muted text-foreground">
          <CalendarDays className="w-5 h-5 text-chart-3" />
          <div className="text-left">
            <p className="text-sm font-medium">Schedule</p>
            <p className="text-xs text-muted-foreground">Book ahead</p>
          </div>
        </Button>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
        <h2 className="text-lg font-semibold text-foreground mb-3">Service Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <button key={cat.id} className="stat-card flex flex-col items-center gap-2 py-5 hover:border-primary/40 cursor-pointer transition-colors active:scale-[0.97]">
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-medium text-foreground">{cat.name}</span>
              <span className="text-xs text-muted-foreground">{cat.count} available</span>
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <h2 className="text-lg font-semibold text-foreground mb-3">Available Workers</h2>
        {nearbyWorkers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nearbyWorkers.map((worker) => (
              <div key={worker.id} className="stat-card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {worker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{worker.name}</p>
                    <p className="text-xs text-muted-foreground">{worker.skill}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-chart-4">
                    <Star className="w-3 h-3 fill-current" /> {worker.rating > 0 ? worker.rating : "New"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${worker.available ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                    {worker.available ? "Online" : "Offline"}
                  </span>
                </div>
                <Button size="sm" className="w-full active:scale-[0.97] transition-transform">Hire Now</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="stat-card flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No workers available right now. Check back soon!</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: "400ms" }}>
        {[
          { label: "My Bookings", value: String(stats.bookings), icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Spent", value: `$${stats.spent.toLocaleString()}`, icon: CreditCard, color: "text-chart-2", bg: "bg-chart-2/10" },
          { label: "Avg. Rating Given", value: stats.avgRating > 0 ? String(stats.avgRating) : "N/A", icon: Star, color: "text-chart-4", bg: "bg-chart-4/10" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{s.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
