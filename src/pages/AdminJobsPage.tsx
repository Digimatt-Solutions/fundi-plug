import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function AdminJobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function loadJobs() {
    const { data } = await supabase
      .from("jobs")
      .select("*, service_categories:category_id(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    const allUserIds = [...new Set([
      ...(data || []).map(j => j.customer_id),
      ...(data || []).map(j => j.worker_id).filter(Boolean),
    ])];
    const { data: profiles } = allUserIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", allUserIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

    setJobs((data || []).map(j => ({
      ...j,
      customerName: nameMap[j.customer_id] || "Unknown",
      workerName: j.worker_id ? (nameMap[j.worker_id] || "Unknown") : null,
      categoryName: (j as any).service_categories?.name || "-",
    })));
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
    const channel = supabase.channel("admin-jobs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => loadJobs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const cancelJob = async (jobId: string) => {
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);
    toast({ title: "Job cancelled" });
    loadJobs();
  };

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.customerName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Jobs Management</h1>
        <p className="text-muted-foreground text-sm">View and manage all platform jobs</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search jobs..." className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="stat-card overflow-hidden p-0 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 text-muted-foreground font-medium">Job</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Client</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Fundi</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Category</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Budget</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {job.image_url && (
                        <img loading="lazy" decoding="async" src={job.image_url} alt="" className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80" onClick={() => setImagePreview(job.image_url)} />
                      )}
                      <span className="font-medium text-foreground">{job.title}</span>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{job.customerName}</td>
                  <td className="p-4 text-muted-foreground">{job.workerName || "-"}</td>
                  <td className="p-4 text-muted-foreground">{job.categoryName}</td>
                  <td className="p-4 text-foreground tabular-nums">{job.budget ? `KSH ${job.budget}` : "-"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      job.status === "completed" ? "bg-green-500/10 text-green-500" :
                      job.status === "in_progress" ? "bg-primary/10 text-primary" :
                      job.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                      "bg-chart-4/10 text-chart-4"
                    }`}>{job.status.replace("_", " ")}</span>
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="p-4">
                    {!["completed", "cancelled"].includes(job.status) && (
                      <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => cancelJob(job.id)}>Cancel</Button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">No jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!imagePreview} onOpenChange={(o) => !o && setImagePreview(null)}>
        <DialogContent className="sm:max-w-lg p-2">
          {imagePreview && <img loading="lazy" decoding="async" src={imagePreview} alt="Job" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
