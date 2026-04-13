import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Star, MapPin, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function FindWorkersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [workerCerts, setWorkerCerts] = useState<any[]>([]);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Hire dialog state
  const [hireDialog, setHireDialog] = useState<any>(null);
  const [hireTitle, setHireTitle] = useState("");
  const [hireDescription, setHireDescription] = useState("");
  const [hireBudget, setHireBudget] = useState("");
  const [hireAddress, setHireAddress] = useState("");
  const [hirePhone, setHirePhone] = useState("");
  const [hireCategoryId, setHireCategoryId] = useState("");
  const [hiring, setHiring] = useState(false);

  useEffect(() => {
    async function load() {
      const [wpsRes, catsRes] = await Promise.all([
        supabase
          .from("worker_profiles")
          .select("*, profiles:user_id(name, email, avatar_url)")
          .eq("verification_status", "approved")
          .order("is_online", { ascending: false }),
        supabase.from("service_categories").select("*").order("name"),
      ]);

      const wps = wpsRes.data || [];
      setCategories(catsRes.data || []);

      const workerUserIds = wps.map(w => w.user_id);
      const { data: reviewsData } = workerUserIds.length > 0
        ? await supabase.from("reviews").select("reviewee_id, rating").in("reviewee_id", workerUserIds)
        : { data: [] };

      const ratingMap: Record<string, { sum: number; count: number }> = {};
      (reviewsData || []).forEach(r => {
        if (!ratingMap[r.reviewee_id]) ratingMap[r.reviewee_id] = { sum: 0, count: 0 };
        ratingMap[r.reviewee_id].sum += r.rating;
        ratingMap[r.reviewee_id].count += 1;
      });

      const skillIds = [...new Set(wps.flatMap(w => w.skills || []))];
      const { data: cats } = skillIds.length > 0
        ? await supabase.from("service_categories").select("id, name").in("id", skillIds)
        : { data: [] };
      const catMap: Record<string, string> = {};
      (cats || []).forEach(c => { catMap[c.id] = c.name; });

      setWorkers(wps.map(w => ({
        ...w,
        name: (w as any).profiles?.name || "Fundi",
        email: (w as any).profiles?.email || "",
        avatar_url: (w as any).profiles?.avatar_url || null,
        skillNames: (w.skills || []).map((s: string) => catMap[s] || "").filter(Boolean),
        rating: ratingMap[w.user_id] ? Math.round(ratingMap[w.user_id].sum / ratingMap[w.user_id].count * 10) / 10 : 0,
        reviewCount: ratingMap[w.user_id]?.count || 0,
      })));
      setLoading(false);
    }
    load();
  }, []);

  const openHireDialog = (worker: any) => {
    setHireDialog(worker);
    setHireTitle(`Hire: ${worker.name}`);
    setHireDescription("");
    setHireBudget(worker.hourly_rate?.toString() || "");
    setHireAddress("");
    setHirePhone(user?.phone || "");
    setHireCategoryId("");
  };

  const hireWorker = async () => {
    if (!user || !hireDialog || !hireTitle.trim() || !hireBudget) {
      toast({ title: "Please fill in job title and price", variant: "destructive" });
      return;
    }
    setHiring(true);

     // Save client phone if provided
     if (hirePhone && hirePhone !== user.phone) {
      await supabase.from("profiles").update({ phone: hirePhone }).eq("id", user.id);
    }

    const { data: job, error } = await supabase.from("jobs").insert({
      title: hireTitle.trim(),
      description: hireDescription.trim() || `Client hired ${hireDialog.name} directly`,
      budget: Number(hireBudget),
      address: hireAddress.trim() || null,
      category_id: hireCategoryId || null,
      customer_id: user.id,
      worker_id: hireDialog.user_id,
      status: "pending",
      is_instant: true,
    }).select().single();

    if (error) {
      toast({ title: "Failed to hire", description: error.message, variant: "destructive" });
      setHiring(false);
      return;
    }

    await supabase.from("activity_logs").insert({
       user_id: user.id, action: "Hire Request Sent",
       detail: `Client sent hire request to ${hireDialog.name}`, entity_type: "job", entity_id: job.id,
    });

    toast({ title: "Hire request sent!", description: `${hireDialog.name} will be notified to accept or reject.` });
    setHireDialog(null);
    setSelectedWorker(null);
    setHiring(false);
    navigate("/dashboard/bookings");
  };

  const openWorkerProfile = async (worker: any) => {
    setSelectedWorker(worker);
    const [certsRes, reviewsRes] = await Promise.all([
      supabase.from("certifications").select("*").eq("worker_id", worker.id),
      supabase.from("reviews").select("*, jobs:job_id(title)").eq("reviewee_id", worker.user_id).order("created_at", { ascending: false }).limit(10),
    ]);

    const reviewerIds = [...new Set((reviewsRes.data || []).map(r => r.reviewer_id))];
    const { data: profiles } = reviewerIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

    setWorkerCerts(certsRes.data || []);
    setWorkerReviews((reviewsRes.data || []).map(r => ({ ...r, reviewerName: nameMap[r.reviewer_id] || "Client" })));
  };

  const filtered = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.skillNames.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Find Fundis</h1>
        <p className="text-muted-foreground text-sm">Browse verified skilled professionals</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or skill..." className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />

      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w, i) => (
            <div key={w.id} className="stat-card space-y-3 cursor-pointer hover:border-primary/40 transition-colors animate-fade-in" style={{ animationDelay: `${i * 60}ms` }} onClick={() => openWorkerProfile(w)}>
              <div className="flex items-center gap-3">
                {w.avatar_url ? (
                  <img src={w.avatar_url} alt={w.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {w.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-foreground">{w.name}</p>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">{w.skillNames.join(", ") || "General"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-chart-4">
                  <Star className="w-3 h-3 fill-current" /> {w.rating > 0 ? `${w.rating} (${w.reviewCount})` : "New"}
                </span>
                {w.hourly_rate && <span className="text-foreground">KSH {w.hourly_rate}/hr</span>}
                <span className={`px-2 py-0.5 rounded-full ${w.is_online ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                  {w.is_online ? "Online" : "Offline"}
                </span>
              </div>
              {w.service_area && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {w.service_area}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <Search className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">No fundis found</p>
          <p className="text-sm text-muted-foreground">Try a different search term</p>
        </div>
      )}

      {/* Worker Profile Dialog */}
      <Dialog open={!!selectedWorker && !hireDialog} onOpenChange={(open) => !open && setSelectedWorker(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedWorker && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedWorker.avatar_url ? (
                    <img src={selectedWorker.avatar_url} alt={selectedWorker.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                      {selectedWorker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="flex items-center gap-1.5">{selectedWorker.name} <CheckCircle className="w-4 h-4 text-green-500" /></p>
                    <p className="text-sm text-muted-foreground font-normal">{selectedWorker.skillNames.join(", ")}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{selectedWorker.rating > 0 ? selectedWorker.rating : "-"}</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{selectedWorker.years_experience || 0}</p>
                    <p className="text-xs text-muted-foreground">Years Exp.</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{selectedWorker.hourly_rate ? `KSH ${selectedWorker.hourly_rate}` : "-"}</p>
                    <p className="text-xs text-muted-foreground">Per Hour</p>
                  </div>
                </div>
                {selectedWorker.bio && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">About</h4>
                    <p className="text-sm text-muted-foreground">{selectedWorker.bio}</p>
                  </div>
                )}
                {workerCerts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Certifications</h4>
                    <div className="space-y-1">
                      {workerCerts.map((cert) => (
                        <div key={cert.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                          <span className="text-foreground">{cert.name}</span>
                          {cert.file_url && <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {workerReviews.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Reviews</h4>
                    <div className="space-y-2">
                      {workerReviews.map((r) => (
                        <div key={r.id} className="p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">{r.reviewerName}</span>
                          </div>
                          {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => openHireDialog(selectedWorker)}>Hire Now</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hire Details Dialog */}
      <Dialog open={!!hireDialog} onOpenChange={(open) => { if (!open) { setHireDialog(null); setSelectedWorker(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Hire {hireDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Fill in the job details. The fundi will be notified and can accept or reject.</p>
            <div className="space-y-2"><Label>Job Title *</Label><Input value={hireTitle} onChange={(e) => setHireTitle(e.target.value)} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={hireDescription} onChange={(e) => setHireDescription(e.target.value)} placeholder="Describe the work needed..." className="bg-muted/50" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Price (KSH) *</Label><Input type="number" value={hireBudget} onChange={(e) => setHireBudget(e.target.value)} placeholder="5000" className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={hireCategoryId} onValueChange={setHireCategoryId}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Address / Location</Label><Input value={hireAddress} onChange={(e) => setHireAddress(e.target.value)} placeholder="123 Main St" className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Your Phone Number</Label><Input value={hirePhone} onChange={(e) => setHirePhone(e.target.value)} placeholder="0712345678" className="bg-muted/50" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireDialog(null)}>Cancel</Button>
            <Button onClick={hireWorker} disabled={hiring || !hireTitle.trim() || !hireBudget}>{hiring ? "Sending..." : "Send Hire Request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
