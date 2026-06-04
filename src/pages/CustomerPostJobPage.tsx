import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Plus, MapPin, Clock, Users, Check, X, CalendarDays, Pencil, ImagePlus, Trash2, MessageCircle, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { friendlyError } from "@/lib/friendlyError";
import PriceLockBadge from "@/components/PriceLockBadge";
import ChatButton from "@/components/chat/ChatButton";
import ChatPopup, { ChatPeer } from "@/components/chat/ChatPopup";
import { Lock } from "lucide-react";
import { AssetImage } from "@/components/AssetImage";

export default function CustomerPostJobPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
  // Page-level chat state so the popup persists when the Applications dialog closes
  const [activeChatPeer, setActiveChatPeer] = useState<ChatPeer | null>(null);

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
    if (error) { toast({ title: "Image upload failed", description: friendlyError(error), variant: "destructive" }); return null; }
    const { data } = await supabase.storage.from("job-images").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl || path;
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
      toast({ title: "Error creating job", description: friendlyError(error), variant: "destructive" });
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
      toast({ title: "Update failed", description: friendlyError(error), variant: "destructive" });
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
      toast({ title: "Delete failed", description: friendlyError(error), variant: "destructive" });
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
    const { data } = await supabase.from("job_applications").select("*, profiles:worker_id(name, avatar_url)").eq("job_id", jobId).order("created_at", { ascending: false });
    setApplications(data || []);
    setLoadingApps(false);
  };

  // Final Price Lock dialog state for accepting an application
  const [priceLockApp, setPriceLockApp] = useState<any>(null);
  const [priceLockValue, setPriceLockValue] = useState("");
  const [confirmingPrice, setConfirmingPrice] = useState(false);

  const handleApplication = async (appId: string, status: "accepted" | "rejected", workerId: string, jobId: string, app?: any) => {
    if (status === "accepted") {
      // Open Final Price Lock dialog instead of assigning immediately
      const parent = applications.find((a) => a.id === appId) || app;
      const parentJob = myJobs.find((j) => j.id === jobId);
      const defaultPrice = parent?.proposed_rate ?? parentJob?.budget ?? "";
      setPriceLockApp({ appId, workerId, jobId, application: parent });
      setPriceLockValue(defaultPrice ? String(defaultPrice) : "");
      return;
    }
    await supabase.from("job_applications").update({ status }).eq("id", appId);
    toast({ title: "Application rejected" });
    viewApplications(jobId); loadData();
  };

  const confirmPriceAndHire = async () => {
    if (!priceLockApp || !priceLockValue || Number(priceLockValue) <= 0) {
      toast({ title: "Enter a valid final price", variant: "destructive" });
      return;
    }
    setConfirmingPrice(true);
    const { appId, workerId, jobId } = priceLockApp;
    const finalPrice = Number(priceLockValue);

    const { error: jobErr } = await supabase.from("jobs").update({
      worker_id: workerId,
      status: "accepted",
      final_price: finalPrice,
      customer_price_confirmed: true,
      worker_price_confirmed: false,
      price_locked_at: null,
    }).eq("id", jobId);
    if (jobErr) {
      toast({ title: "Failed to confirm price", description: friendlyError(jobErr), variant: "destructive" });
      setConfirmingPrice(false);
      return;
    }
    await supabase.from("job_applications").update({ status: "accepted" }).eq("id", appId);
    await supabase.from("job_applications").update({ status: "rejected" }).eq("job_id", jobId).neq("id", appId);
    await supabase.from("activity_logs").insert([
      { user_id: user!.id, action: "Final Price Set", detail: `Client confirmed final price KSH ${finalPrice.toLocaleString()} - awaiting fundi confirmation`, entity_type: "job", entity_id: jobId },
    ]);
    toast({ title: "Fundi hired - price awaiting fundi confirmation" });
    setPriceLockApp(null);
    setPriceLockValue("");
    setConfirmingPrice(false);
    viewApplications(jobId); loadData();
  };

  // Re-edit price after the fundi rejected or before they confirm
  const [editPriceJob, setEditPriceJob] = useState<any>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const saveEditedPrice = async () => {
    if (!editPriceJob || !editPriceValue || Number(editPriceValue) <= 0) return;
    const { error } = await supabase.from("jobs").update({
      final_price: Number(editPriceValue),
      customer_price_confirmed: true,
      worker_price_confirmed: false,
      price_rejected_at: null,
    } as any).eq("id", editPriceJob.id);
    if (error) {
      toast({ title: "Update failed", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({ title: "Updated - awaiting fundi confirmation" });
    setEditPriceJob(null); setEditPriceValue(""); loadData();
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
          <img loading="lazy" decoding="async" src={preview} alt="Job" className="w-full h-full object-cover" />
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
          <p className="text-muted-foreground text-sm">{t("Post jobs and manage fundi applications")}</p>
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
                      <AssetImage loading="lazy" decoding="async" src={job.image_url} bucket="job-images" alt={job.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
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
                        {job.is_instant && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive text-destructive-foreground">URGENT</span>
                        )}
                        <PriceLockBadge job={job} />
                      </div>
                      {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {job.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.address}</span>}
                        <span className="flex items-center gap-1">KSH {job.budget ? job.budget.toLocaleString() : "Open"}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
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
                    {job.worker_id && !job.price_locked_at && (
                      <Button size="sm" variant="outline" onClick={() => { setEditPriceJob(job); setEditPriceValue(String(job.final_price ?? job.budget ?? "")); }} className="active:scale-[0.97]">
                        <Pencil className="w-4 h-4 mr-1" /> Edit Final Price
                      </Button>
                    )}
                    {canDeleteJob(job) && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive active:scale-[0.97]" onClick={() => setDeleteJobConfirm(job)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
                {(job as any).price_rejected_at && !job.price_locked_at && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-foreground">The fundi rejected the proposed final price.</p>
                      <p className="text-xs text-muted-foreground">Adjust the price and resend - the fundi will need to confirm the new amount.</p>
                    </div>
                    <Button size="sm" onClick={() => { setEditPriceJob(job); setEditPriceValue(String(job.final_price ?? job.budget ?? "")); }}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Price
                    </Button>
                  </div>
                )}
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
          <DialogHeader><DialogTitle>{t("Post a New Job")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{t("Job Title *")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Fix kitchen faucet")} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>{t("Description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Describe the work needed...")} className="bg-muted/50" /></div>
            <ImageUploadField preview={jobImagePreview} onSelect={(f) => handleImageSelect(f, setJobImage, setJobImagePreview)} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("Budget (KSH)")}</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={t("5000")} className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>{t("Category")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder={t("Select")} /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("Address / Location")}</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("123 Main St")} className="bg-muted/50" /></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Timeline / Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-muted/50" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isInstant} onChange={(e) => setIsInstant(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-foreground">{t("Instant service (urgent request)")}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("Cancel")}</Button>
            <Button onClick={createJob} disabled={creating || !title.trim()}>{creating ? "Posting..." : "Post Job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={!!editJob} onOpenChange={(open) => !open && setEditJob(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Edit Job Post")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{t("Job Title *")}</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>{t("Description")}</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-muted/50" /></div>
            <ImageUploadField preview={editImagePreview} onSelect={(f) => handleImageSelect(f, setEditImage, setEditImagePreview)} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("Budget (KSH)")}</Label><Input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>{t("Category")}</Label>
                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder={t("Select")} /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("Address / Location")}</Label><Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="bg-muted/50" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditJob(null)}>{t("Cancel")}</Button>
            <Button onClick={saveEditJob} disabled={saving || !editTitle.trim()}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applications Dialog */}
      <Dialog open={!!viewAppsJobId} onOpenChange={(open) => !open && setViewAppsJobId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("Job Applications")}</DialogTitle></DialogHeader>
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
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveChatPeer({
                        id: app.worker_id,
                        name: (app as any).profiles?.name || "Fundi",
                        avatar_url: (app as any).profiles?.avatar_url,
                        jobId: app.job_id,
                      })}
                    >
                      <MessageCircle className="w-4 h-4 mr-1" /> Chat with fundi to agree on final price
                    </Button>
                  </div>

                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">{t("No applications yet")}</p>}
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation */}
      <AlertDialog open={!!deleteJobConfirm} onOpenChange={(open) => !open && setDeleteJobConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete this job?")}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteJobConfirm?.title}" and all its applications will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteJob} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Price Lock Dialog (when accepting an application) */}
      <Dialog open={!!priceLockApp} onOpenChange={(open) => { if (!open) { setPriceLockApp(null); setPriceLockValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Confirm Final Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set the final agreed price for this job. The fundi will then need to confirm before it is locked.
            </p>
            {priceLockApp?.application?.proposed_rate && (
              <p className="text-xs text-muted-foreground">Fundi proposed: <strong className="text-foreground">KSH {Number(priceLockApp.application.proposed_rate).toLocaleString()}</strong></p>
            )}
            <div className="space-y-2">
              <Label>Final Price (KSH) *</Label>
              <Input type="number" min="1" value={priceLockValue} onChange={(e) => setPriceLockValue(e.target.value)} className="bg-muted/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPriceLockApp(null); setPriceLockValue(""); }}>Cancel</Button>
            <Button onClick={confirmPriceAndHire} disabled={confirmingPrice || !priceLockValue}>
              {confirmingPrice ? "Confirming..." : "Confirm & Hire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Final Price Dialog */}
      <Dialog open={!!editPriceJob} onOpenChange={(open) => { if (!open) { setEditPriceJob(null); setEditPriceValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Final Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Updating the price will require the fundi to confirm again before it is locked.
            </p>
            <div className="space-y-2">
              <Label>Final Price (KSH) *</Label>
              <Input type="number" min="1" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="bg-muted/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditPriceJob(null); setEditPriceValue(""); }}>Cancel</Button>
            <Button onClick={saveEditedPrice} disabled={!editPriceValue}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeChatPeer && (
        <ChatPopup peer={activeChatPeer} onClose={() => setActiveChatPeer(null)} />
      )}
    </div>

  );
}
