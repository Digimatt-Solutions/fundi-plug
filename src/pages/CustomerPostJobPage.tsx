import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Plus, MapPin, Clock, Users, Check, X, CalendarDays, Pencil, ImagePlus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [jobImage, setJobImage] = useState<File | null>(null);
  const [jobImagePreview, setJobImagePreview] = useState<string | null>(null);
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
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
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

  const handleImageSelect = (file: File | null, setFile: (f: File | null) => void, setPreview: (p: string | null) => void) => {
    if (!file) { setFile(null); setPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadJobImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("job-images").upload(path, file);
    if (error) { toast({ title: "Image upload failed", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("job-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const createJob = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);

    let imageUrl: string | null = null;
    if (jobImage) imageUrl = await uploadJobImage(jobImage);

    const { error } = await supabase.from("jobs").insert({
      title: title.trim(), description: description.trim() || null,
      budget: budget ? Number(budget) : null, address: address.trim() || null,
      category_id: categoryId || null, customer_id: user.id, is_instant: isInstant,
      image_url: imageUrl,
    });
    if (error) {
      toast({ title: "Error creating job", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job posted!" });
      await supabase.from("activity_logs").insert({
        user_id: user.id, action: "Job Posted", detail: `Posted "${title.trim()}"${deadline ? ` - Deadline: ${deadline}` : ""}`, entity_type: "job",
      });
      setTitle(""); setDescription(""); setBudget(""); setAddress(""); setCategoryId(""); setIsInstant(false); setDeadline(""); setJobImage(null); setJobImagePreview(null); setShowCreate(false);
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
    setEditImage(null);
    setEditImagePreview(job.image_url || null);
  };

  const saveEditJob = async () => {
    if (!editJob || !editTitle.trim()) return;
    setSaving(true);

    let imageUrl = editJob.image_url;
    if (editImage) {
      const uploaded = await uploadJobImage(editImage);
      if (uploaded) imageUrl = uploaded;
    }

    const { error } = await supabase.from("jobs").update({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      budget: editBudget ? Number(editBudget) : null,
      address: editAddress.trim() || null,
      category_id: editCategoryId || null,
      image_url: imageUrl,
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

  const canDeleteJob = (job: any) => {
    // Allow deletion when no fundi is actively working: pending (no worker), cancelled, or completed
    return ["pending", "cancelled", "completed"].includes(job.status) && !["accepted", "in_progress"].includes(job.status);
  };

  const [deleteJobConfirm, setDeleteJobConfirm] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteJob = async () => {
    if (!deleteJobConfirm) return;
    setDeleting(true);
    // Clean up dependent rows that may reference the job
    await supabase.from("job_applications").delete().eq("job_id", deleteJobConfirm.id);
    await supabase.from("bookings").delete().eq("job_id", deleteJobConfirm.id);
    const { error } = await supabase.from("jobs").delete().eq("id", deleteJobConfirm.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job deleted" });
      await supabase.from("activity_logs").insert({
        user_id: user!.id, action: "Job Deleted", detail: `Deleted "${deleteJobConfirm.title}"`, entity_type: "job", entity_id: deleteJobConfirm.id,
      });
      setDeleteJobConfirm(null);
      loadData();
    }
    setDeleting(false);
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
        { user_id: user!.id, action: "Fundi Selected", detail: `Client selected a fundi for job`, entity_type: "job", entity_id: jobId },
      ]);
      toast({ title: "Fundi hired!" });
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

  const ImageUploadField = ({ preview, onSelect }: { preview: string | null; onSelect: (f: File | null) => void }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2"><ImagePlus className="w-4 h-4" /> Work Image</Label>
      {preview && (
        <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted">
          <img src={preview} alt="Job" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onSelect(null)} className="absolute top-1 right-1 bg-background/80 rounded-full p-1 text-destructive hover:bg-background">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <Input type="file" accept="image/*" onChange={(e) => onSelect(e.target.files?.[0] || null)} className="bg-muted/50" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-muted-foreground text-sm">Post jobs and manage fundi applications</p>
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
                  <div className="flex gap-3">
                    {job.image_url && (
                      <img src={job.image_url} alt={job.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
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
                    {canDeleteJob(job) && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive active:scale-[0.97]" onClick={() => setDeleteJobConfirm(job)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
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
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Post a New Job</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Job Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fix kitchen faucet" className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the work needed..." className="bg-muted/50" /></div>
            <ImageUploadField preview={jobImagePreview} onSelect={(f) => handleImageSelect(f, setJobImage, setJobImagePreview)} />
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
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Job Post</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Job Title *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-muted/50" /></div>
            <ImageUploadField preview={editImagePreview} onSelect={(f) => handleImageSelect(f, setEditImage, setEditImagePreview)} />
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
                      <p className="font-medium text-foreground text-sm">{(app as any).profiles?.name || "Fundi"}</p>
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