import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Star, MapPin, CheckCircle, Phone, Mail, Briefcase, Navigation, ShieldCheck, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { maskEmail, maskPhone } from "@/lib/mask";
import { MapPreview } from "@/components/MapPreview";
import { friendlyError } from "@/lib/friendlyError";
import QRScanner from "@/components/QRScanner";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ALL_TAB = "__all__";

export default function FindWorkersPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_TAB);
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(null);
  // Set of worker user_ids that this customer has an active/successful hire with
  const [unlockedWorkerIds, setUnlockedWorkerIds] = useState<Set<string>>(new Set());

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCustomerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, []);

  // Load existing hires so we can reveal contacts of fundis already engaged
  useEffect(() => {
    async function loadUnlocked() {
      if (!user) return;
      const { data } = await supabase
        .from("jobs")
        .select("worker_id, status")
        .eq("customer_id", user.id)
        .in("status", ["accepted", "in_progress", "completed"])
        .not("worker_id", "is", null);
      const ids = new Set<string>();
      (data || []).forEach((j: any) => j.worker_id && ids.add(j.worker_id));
      setUnlockedWorkerIds(ids);
    }
    loadUnlocked();
  }, [user]);

  useEffect(() => {
    async function load() {
      const [wpsRes, catsRes] = await Promise.all([
        supabase
          .from("worker_profiles")
          .select("*, profiles:user_id(name, email, phone, avatar_url)")
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
        phone: (w as any).profiles?.phone || "",
        avatar_url: (w as any).profiles?.avatar_url || null,
        skillIds: w.skills || [],
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
    setHireTitle(`${t("Hire")}: ${worker.name}`);
    setHireDescription("");
    setHireBudget(worker.hourly_rate?.toString() || "");
    setHireAddress("");
    setHirePhone(user?.phone || "");
    setHireCategoryId("");
  };

  const hireWorker = async () => {
    if (!user || !hireDialog || !hireTitle.trim() || !hireBudget) {
      toast({ title: t("Please fill in job title and price"), variant: "destructive" });
      return;
    }
    setHiring(true);
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
      toast({ title: t("Failed to hire"), description: friendlyError(error), variant: "destructive" });
      setHiring(false);
      return;
    }
    await supabase.from("activity_logs").insert({
      user_id: user.id, action: "Hire Request Sent",
      detail: `Client sent hire request to ${hireDialog.name}`, entity_type: "job", entity_id: job.id,
    });
    toast({ title: t("Hire request sent!"), description: `${hireDialog.name} ${t("will be notified to accept or reject.")}` });
    setHireDialog(null);
    setSelectedWorker(null);
    setHiring(false);
    navigate("/dashboard/bookings");
  };

  const openWorkerProfile = async (worker: any) => {
    setSelectedWorker(worker);
    // Track this profile view (fire-and-forget; ignore failures)
    if (user && worker.user_id !== user.id) {
      supabase.from("profile_views").insert({
        worker_id: worker.user_id,
        viewer_id: user.id,
      }).then(() => {});
    }
    const reviewsRes = await supabase
      .from("reviews")
      .select("*, jobs:job_id(title)")
      .eq("reviewee_id", worker.user_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const reviewerIds = [...new Set((reviewsRes.data || []).map(r => r.reviewer_id))];
    const { data: profiles } = reviewerIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

    setWorkerReviews((reviewsRes.data || []).map(r => ({ ...r, reviewerName: nameMap[r.reviewer_id] || t("Client") })));
  };

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `~${Math.round(km)} km`;
  };

  const getDist = (w: any) => {
    if (!customerPos || !w.latitude || !w.longitude) return null;
    return getDistanceKm(customerPos.lat, customerPos.lng, w.latitude, w.longitude);
  };

  const filtered = useMemo(() => workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.skillNames.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  ), [workers, search]);

  // Categories that actually have workers (for tab visibility)
  const tabCategories = useMemo(() => {
    const list = categories
      .map((c) => ({ ...c, count: filtered.filter((w) => (w.skillIds || []).includes(c.id)).length }))
      .filter((c) => c.count > 0);
    const otherCount = filtered.filter(
      (w) => !(w.skillIds || []).some((s: string) => categories.find((c) => c.id === s))
    ).length;
    if (otherCount > 0) {
      list.push({ id: "other", name: t("General"), icon: "🔧", count: otherCount } as any);
    }
    return list;
  }, [filtered, categories, t]);

  const visibleWorkers = useMemo(() => {
    if (activeCategory === ALL_TAB) return filtered;
    if (activeCategory === "other") {
      return filtered.filter(
        (w) => !(w.skillIds || []).some((s: string) => categories.find((c) => c.id === s))
      );
    }
    return filtered.filter((w) => (w.skillIds || []).includes(activeCategory));
  }, [filtered, activeCategory, categories]);

  const renderWorkerCard = (w: any, i: number) => {
    const dist = getDist(w);
    return (
      <div key={w.id} className="stat-card space-y-3 cursor-pointer hover:border-primary/40 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }} onClick={() => openWorkerProfile(w)}>
        <div className="flex items-center gap-3">
          {w.avatar_url ? (
            <img loading="lazy" decoding="async" src={w.avatar_url} alt={w.name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {w.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-foreground truncate">{w.name}</p>
              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground truncate">{w.skillNames.join(", ") || t("General")}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-chart-4">
            <Star className="w-3 h-3 fill-current" /> {w.rating > 0 ? `${w.rating} (${w.reviewCount})` : t("New")}
          </span>
          {w.hourly_rate && <span className="text-foreground">KSH {w.hourly_rate}/hr</span>}
          <span className={`px-2 py-0.5 rounded-full ${w.is_online ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
            {w.is_online ? t("Online") : t("Offline")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {(w.service_area || w.county) && (
            <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {w.service_area || w.county}</span>
          )}
          {dist != null && w.is_online && (
            <span className="flex items-center gap-1 text-primary font-medium"><Navigation className="w-3 h-3" /> {formatDistance(dist)}</span>
          )}
        </div>
        <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); openHireDialog(w); }}>
          <Briefcase className="w-3.5 h-3.5 mr-1" /> {t("Hire")}
        </Button>
      </div>
    );
  };

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
        <h1 className="text-2xl font-bold text-foreground">{t("Find Fundis")}</h1>
        <p className="text-muted-foreground text-sm">{t("Browse verified skilled professionals")}</p>
      </div>

      {/* Horizontal category tabs (sticky on top, like dashboard) */}
      <div className="sticky top-0 z-10 -mx-4 px-4 bg-background/80 backdrop-blur-md border-b border-border py-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setActiveCategory(ALL_TAB)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activeCategory === ALL_TAB
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary/40"
            }`}
          >
            {t("All")} ({filtered.length})
          </button>
          {tabCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5 ${
                activeCategory === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              <span>{c.icon || "🔧"}</span>
              <span>{c.name}</span>
              <span className="opacity-70">({c.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t("Search by name or skill...")} className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {visibleWorkers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleWorkers.map((w, i) => renderWorkerCard(w, i))}
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <Search className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">{t("No fundis found")}</p>
          <p className="text-sm text-muted-foreground">{t("Try a different search term")}</p>
        </div>
      )}

      {/* Worker Profile Dialog - full details */}
      <Dialog open={!!selectedWorker && !hireDialog} onOpenChange={(open) => !open && setSelectedWorker(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedWorker && (() => {
            const dist = getDist(selectedWorker);
            const unlocked = unlockedWorkerIds.has(selectedWorker.user_id);
            const phoneShown = unlocked ? selectedWorker.phone : maskPhone(selectedWorker.phone);
            const emailShown = unlocked ? selectedWorker.email : maskEmail(selectedWorker.email);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {selectedWorker.avatar_url ? (
                      <img loading="lazy" decoding="async" src={selectedWorker.avatar_url} alt={selectedWorker.name} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                        {selectedWorker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="flex items-center gap-1.5">
                        {selectedWorker.name}
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${selectedWorker.is_online ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                          {selectedWorker.is_online ? t("Online") : t("Offline")}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground font-normal">{selectedWorker.skillNames.join(", ") || t("General")}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-foreground">{selectedWorker.rating > 0 ? selectedWorker.rating : "-"}</p>
                      <p className="text-xs text-muted-foreground">{t("Rating")}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-foreground">{selectedWorker.years_experience || 0}</p>
                      <p className="text-xs text-muted-foreground">{t("Years Exp.")}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-foreground">{selectedWorker.hourly_rate ? `KSH ${selectedWorker.hourly_rate}` : "-"}</p>
                      <p className="text-xs text-muted-foreground">{t("Per Hour")}</p>
                    </div>
                  </div>

                  {/* Digimatt verified badge (replaces certs list for clients) */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm text-foreground"><span className="font-medium">{t("Certified by Digimatt")}</span> - {t("This fundi has been vetted and approved.")}</p>
                  </div>

                  {/* Live map preview */}
                  {customerPos && selectedWorker.latitude && selectedWorker.longitude && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-primary" /> {t("Live Location")}
                      </h4>
                      <MapPreview
                        customer={customerPos}
                        worker={{ lat: selectedWorker.latitude, lng: selectedWorker.longitude }}
                        distanceLabel={dist != null ? formatDistance(dist) : undefined}
                      />
                    </div>
                  )}

                  {/* Contact & Location details */}
                  <div className="space-y-2 text-sm">
                    {selectedWorker.phone && (
                      <div className="flex items-center gap-2 text-foreground">
                        {unlocked ? <Phone className="w-3.5 h-3.5 text-muted-foreground" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        {phoneShown}
                      </div>
                    )}
                    {selectedWorker.email && (
                      <div className="flex items-center gap-2 text-foreground">
                        {unlocked ? <Mail className="w-3.5 h-3.5 text-muted-foreground" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        {emailShown}
                      </div>
                    )}
                    {!unlocked && (
                      <p className="text-xs text-muted-foreground italic">{t("Contact details are revealed once your hire request is accepted.")}</p>
                    )}
                    {(selectedWorker.county || selectedWorker.constituency || selectedWorker.ward) && (
                      <div className="flex items-start gap-2 text-foreground">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                        <span>{[selectedWorker.ward, selectedWorker.constituency, selectedWorker.county].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {selectedWorker.service_area && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">{t("Service Area")}: {selectedWorker.service_area}</div>
                    )}
                  </div>

                  {selectedWorker.bio && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-1">{t("About")}</h4>
                      <p className="text-sm text-muted-foreground">{selectedWorker.bio}</p>
                    </div>
                  )}

                  {workerReviews.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">{t("Customer Reviews")}</h4>
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
                  <Button className="w-full" onClick={() => openHireDialog(selectedWorker)}>
                    <Briefcase className="w-4 h-4 mr-2" /> {t("Hire This Fundi")}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Hire Details Dialog */}
      <Dialog open={!!hireDialog} onOpenChange={(open) => { if (!open) { setHireDialog(null); setSelectedWorker(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("Hire")} {hireDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("Fill in the job details. The fundi will be notified and can accept or reject.")}</p>
            <div className="space-y-2"><Label>{t("Job Title *")}</Label><Input value={hireTitle} onChange={(e) => setHireTitle(e.target.value)} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>{t("Description")}</Label><Textarea value={hireDescription} onChange={(e) => setHireDescription(e.target.value)} placeholder={t("Describe the work needed...")} className="bg-muted/50" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("Price (KSH) *")}</Label><Input type="number" value={hireBudget} onChange={(e) => setHireBudget(e.target.value)} placeholder="5000" className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>{t("Category")}</Label>
                <Select value={hireCategoryId} onValueChange={setHireCategoryId}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder={t("Select")} /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("Address / Location")}</Label><Input value={hireAddress} onChange={(e) => setHireAddress(e.target.value)} placeholder="123 Main St" className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>{t("Your Phone Number")}</Label><Input value={hirePhone} onChange={(e) => setHirePhone(e.target.value)} placeholder="0712345678" className="bg-muted/50" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireDialog(null)}>{t("Cancel")}</Button>
            <Button onClick={hireWorker} disabled={hiring || !hireTitle.trim() || !hireBudget}>{hiring ? t("Sending...") : t("Send Hire Request")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
