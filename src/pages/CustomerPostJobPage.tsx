import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Plus, MapPin, Clock, Users, Check, X, CalendarDays, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CustomerPostJobPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [address, setAddress] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isInstant, setIsInstant] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [viewAppsJobId, setViewAppsJobId] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  // Edit state
  const [editJob, setEditJob] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    if (!user) return;
    const [jobsRes, catsRes] = await Promise.all([
      supabase.from("jobs").select("*, service_categories:category_id(name, icon)").eq("customer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("service_categories").select("*").order("name"),
    ]);
    setMyJobs(jobsRes.data || []);
    setCategories(catsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const channel = supabase.channel("customer-jobs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `customer_id=eq.${user?.id}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "job_applications" }, () => {
        if (viewAppsJobId) viewApplications(viewAppsJobId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const createJob = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("jobs").insert({
      title: title.trim(), description: description.trim() || null,
      budget: budget ? Number(budget) : null, address: address.trim() || null,
      category_id: categoryId || null, customer_id: user.id, is_instant: isInstant,
    });
    if (error) {
      toast({ title: "Error creating job", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job posted!" });
      await supabase.from("activity_logs").insert({
        user_id: user.id, action: "Job Posted", detail: `Posted "${title.trim()}"${deadline ? ` - Deadline: ${deadline}` : ""}`, entity_type: "job",
      });
      setTitle(""); setDescription(""); setBudget(""); setAddress(""); setCategoryId(""); setIsInstant(false); setDeadline(""); setShowCreate(false);
    }
    setCreating(false); loadData();
  };

  const openEditJob = (job: any) => {
    setEditJob(job);
    setEditTitle(job.title);
    setEditDescription(job.description || "");
    setEditBudget(job.budget?.toString() || "");
    setEditAddress(job.address || "");
    setEditCategoryId(job.category_id || "");
  };

  const saveEditJob = async () => {
    if (!editJob || !editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("jobs").update({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      budget: editBudget ? Number(editBudget) : null,
      address: editAddress.trim() || null,
      category_id: editCategoryId || null,
    }).eq("id", editJob.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job updated!" });
      setEditJob(null);
      loadData();
    }
    setSaving(false);
  };

  const canEditJob = (job: any) => {
    return ["pending"].includes(job.status) && !job.worker_id;
  };

  const viewApplications = async (jobId: string) => {
    setViewAppsJobId(jobId);
    setLoadingApps(true);
    const { data } = await supabase.from("job_applications").select("*, profiles:worker_id(name, email, phone)").eq("job_id", jobId).order("created_at", { ascending: false });
    setApplications(data || []);
    setLoadingApps(false);
  };

  const handleApplication = async (appId: string, status: "accepted" | "rejected", workerId: string, jobId: string) => {
    await supabase.from("job_applications").update({ status }).eq("id", appId);
    if (status === "accepted") {
      await supabase.from("jobs").update({ worker_id: workerId, status: "accepted" }).eq("id", jobId);
      await supabase.from("job_applications").update({ status: "rejected" }).eq("job_id", jobId).neq("id", appId);
      await supabase.from("activity_logs").insert([
        { user_id: user!.id, action: "Worker Selected", detail: `Customer selected a worker for job`, entity_type: "job", entity_id: jobId },
      ]);
      toast({ title: "Worker hired!" });
    } else {
      toast({ title: "Application rejected" });
    }
    viewApplications(jobId); loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeJobs = myJobs.filter(j => ["pending", "accepted", "in_progress"].includes(j.status));
  const pastJobs = myJobs.filter(j => ["completed", "cancelled"].includes(j.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-muted-foreground text-sm">Post jobs and manage worker applications</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="active:scale-[0.97]"><Plus className="w-4 h-4 mr-2" /> Post a Job</Button>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="active">Active ({activeJobs.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({pastJobs.length})</TabsTrigger>
        </TabsList>
        {["active", "past"].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {(tab === "active" ? activeJobs : pastJobs).length > 0 ? (tab === "active" ? activeJobs : pastJobs).map((job, i) => (
              <div key={job.id} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{(job as any).service_categories?.icon || "🔧"}</span>
                      <h3 className="font-semibold text-foreground">{job.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        job.status === "completed" ? "bg-green-500/10 text-green-500" :
                        job.status === "in_progress" ? "bg-primary/10 text-primary" :
                        job.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                        "bg-chart-4/10 text-chart-4"
                      }`}>{job.status.replace("_", " ")}</span>
                    </div>
                    {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {job.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.address}</span>}
                      <span className="flex items-center gap-1">KSH {job.budget ? job.budget.toLocaleString() : "Open"}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEditJob(job) && (
                      <Button size="sm" variant="outline" onClick={() => openEditJob(job)} className="active:scale-[0.97]">
                        <Pencil className="w-4 h-4 mr-1" /> Edit
                      </Button>
                    )}
                    {job.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => viewApplications(job.id)} className="active:scale-[0.97]">
                        <Users className="w-4 h-4 mr-1" /> Applications
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="stat-card flex flex-col items-center py-16 text-center">
                <Briefcase className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-foreground font-medium">No {tab} jobs</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Job Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Post a New Job</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Job Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fix kitchen faucet" className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the work needed..." className="bg-muted/50" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Budget (KSH)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="5000" className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Address / Location</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="bg-muted/50" /></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Timeline / Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-muted/50" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isInstant} onChange={(e) => setIsInstant(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-foreground">Instant service (urgent request)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createJob} disabled={creating || !title.trim()}>{creating ? "Posting..." : "Post Job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={!!editJob} onOpenChange={(open) => !open && setEditJob(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Job Post</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Job Title *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-muted/50" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Budget (KSH)</Label><Input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Address / Location</Label><Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="bg-muted/50" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditJob(null)}>Cancel</Button>
            <Button onClick={saveEditJob} disabled={saving || !editTitle.trim()}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applications Dialog */}
      <Dialog open={!!viewAppsJobId} onOpenChange={(open) => !open && setViewAppsJobId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Job Applications</DialogTitle></DialogHeader>
          {loadingApps ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {applications.map((app) => (
                <div key={app.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{(app as any).profiles?.name || "Worker"}</p>
                      <p className="text-xs text-muted-foreground">{(app as any).profiles?.email}</p>
                      {(app as any).profiles?.phone && <p className="text-xs text-muted-foreground">Tel: {(app as any).profiles?.phone}</p>}
                    </div>
                    {app.status === "pending" ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleApplication(app.id, "accepted", app.worker_id, app.job_id)}><Check className="w-3 h-3 mr-1" /> Accept</Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleApplication(app.id, "rejected", app.worker_id, app.job_id)}><X className="w-3 h-3 mr-1" /> Reject</Button>
                      </div>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${app.status === "accepted" ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>{app.status}</span>
                    )}
                  </div>
                  {app.cover_note && <p className="text-xs text-muted-foreground">{app.cover_note}</p>}
                  {app.proposed_rate && <p className="text-xs text-foreground">Proposed: KSH {app.proposed_rate}</p>}
                  <p className="text-xs text-muted-foreground">Applied: {new Date(app.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No applications yet</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
