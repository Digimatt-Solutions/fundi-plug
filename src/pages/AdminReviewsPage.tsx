import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
  reviewee_id: string;
  job_id: string;
  reviewerName: string;
  revieweeName: string;
  jobTitle: string;
  categoryName: string;
  revieweeRole: "worker" | "customer" | "unknown";
}

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id, reviewee_id, job_id")
      .order("created_at", { ascending: false });

    const list = reviews || [];
    const userIds = Array.from(new Set(list.flatMap(r => [r.reviewer_id, r.reviewee_id])));
    const jobIds = Array.from(new Set(list.map(r => r.job_id).filter(Boolean)));

    const [profilesRes, rolesRes, jobsRes] = await Promise.all([
      userIds.length ? supabase.rpc("admin_list_profiles") : Promise.resolve({ data: [] } as any),
      userIds.length ? supabase.from("user_roles").select("user_id, role").in("user_id", userIds) : Promise.resolve({ data: [] } as any),
      jobIds.length ? supabase.from("jobs").select("id, title, category_id, service_categories:category_id(name)").in("id", jobIds) : Promise.resolve({ data: [] } as any),
    ]);

    const nameMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => { nameMap[p.id] = p.name || p.email || "User"; });
    const roleMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    const jobMap: Record<string, any> = {};
    (jobsRes.data || []).forEach((j: any) => { jobMap[j.id] = j; });

    setRows(list.map((r: any) => ({
      ...r,
      reviewerName: nameMap[r.reviewer_id] || "User",
      revieweeName: nameMap[r.reviewee_id] || "User",
      jobTitle: jobMap[r.job_id]?.title || "-",
      categoryName: jobMap[r.job_id]?.service_categories?.name || "Uncategorized",
      revieweeRole: (roleMap[r.reviewee_id] as any) || "unknown",
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    setRows((r) => r.filter((x) => x.id !== id));
    toast({ title: "Review deleted" });
  };

  const filterByRole = (role: "worker" | "customer") =>
    rows.filter((r) => r.revieweeRole === role).filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.reviewerName.toLowerCase().includes(q) ||
        r.revieweeName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        (r.comment || "").toLowerCase().includes(q);
    });

  const grouped = (list: ReviewRow[]) => {
    const map: Record<string, ReviewRow[]> = {};
    list.forEach((r) => {
      (map[r.categoryName] ||= []).push(r);
    });
    return map;
  };

  const renderList = (role: "worker" | "customer") => {
    const list = filterByRole(role);
    if (!list.length) return <p className="text-sm text-muted-foreground py-8 text-center">No reviews</p>;
    const groups = grouped(list);
    return (
      <div className="space-y-6">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{cat} <span className="text-muted-foreground font-normal">({items.length})</span></h3>
            <div className="space-y-2">
              {items.map((r) => (
                <div key={r.id} className="stat-card p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{r.reviewerName}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm font-medium text-foreground">{r.revieweeName}</span>
                      <span className="text-xs text-muted-foreground">- {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground">Job: {r.jobTitle}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReview(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
        <p className="text-muted-foreground text-sm">Browse and moderate all reviews by category.</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search reviewer, reviewee, category, comment…" className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Tabs defaultValue="workers" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="workers">Reviews of Fundis</TabsTrigger>
          <TabsTrigger value="customers">Reviews of Clients</TabsTrigger>
        </TabsList>
        <TabsContent value="workers">{renderList("worker")}</TabsContent>
        <TabsContent value="customers">{renderList("customer")}</TabsContent>
      </Tabs>
    </div>
  );
}
