import { useEffect, useState, useMemo } from "react";
import { Search, MapPin, Star, Zap, CalendarDays, CreditCard, Briefcase, Navigation, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, X, FileText, UserCheck, CheckCircle, Phone, Mail, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { friendlyError } from "@/lib/friendlyError";
import CategoriesScroller from "./CategoriesScroller";
import { maskEmail, maskPhone } from "@/lib/mask";
import { MapPreview } from "@/components/MapPreview";

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "Electrician": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
  "Plumber": "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop",
  "Carpenter": "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop",
  "Painter": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop",
  "Mason": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop",
  "Welder": "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
  "Mechanic": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop",
  "Cleaner": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop",
  "Tiler": "https://images.unsplash.com/photo-1523413363574-c30aa1c2a516?w=600&h=400&fit=crop",
  "Roofer": "https://images.unsplash.com/photo-1632759145355-8b8f4c4d8f6f?w=600&h=400&fit=crop",
  "HVAC Technician": "https://images.unsplash.com/photo-1617104678098-de229db51175?w=600&h=400&fit=crop",
};

const FUNDIS_PER_PAGE = 12;

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [nearbyWorkers, setNearbyWorkers] = useState<any[]>([]);
  const [stats, setStats] = useState({ bookings: 0, spent: 0, avgRating: 0 });
  const [loading, setLoading] = useState(true);
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [unpaidJobs, setUnpaidJobs] = useState<any[]>([]);
  const [showThanks, setShowThanks] = useState(false);

  // Hire dialog state
  const [hireDialog, setHireDialog] = useState<any>(null);
  const [hireTitle, setHireTitle] = useState("");
  const [hireDescription, setHireDescription] = useState("");
  const [hireBudget, setHireBudget] = useState("");
  const [hireAddress, setHireAddress] = useState("");
  const [hirePhone, setHirePhone] = useState("");
  const [hireCategoryId, setHireCategoryId] = useState("");
  const [hiring, setHiring] = useState(false);

  // Worker profile dialog
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);
  const [unlockedWorkerIds, setUnlockedWorkerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("worker_id, status")
        .eq("customer_id", user.id)
        .in("status", ["accepted", "in_progress", "completed"])
        .not("worker_id", "is", null);
      const ids = new Set<string>();
      (data || []).forEach((j: any) => j.worker_id && ids.add(j.worker_id));
      setUnlockedWorkerIds(ids);
    })();
  }, [user]);

  const openWorkerProfile = async (worker: any) => {
    setSelectedWorker(worker);
    const reviewsRes = await supabase
      .from("reviews")
      .select("*, jobs:job_id(title)")
      .eq("reviewee_id", worker.user_id)
      .order("created_at", { ascending: false })
      .limit(10);
    const reviewerIds = [...new Set((reviewsRes.data || []).map((r: any) => r.reviewer_id))];
    const { data: profiles } = reviewerIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { nameMap[p.id] = p.name; });
    setWorkerReviews((reviewsRes.data || []).map((r: any) => ({ ...r, reviewerName: nameMap[r.reviewer_id] || t("Client") })));
  };

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
      toast({ title: "Please fill in job title and price", variant: "destructive" });
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
      toast({ title: "Failed to hire", description: friendlyError(error), variant: "destructive" });
      setHiring(false);
      return;
    }
    await supabase.from("activity_logs").insert({
       user_id: user.id, action: "Hire Request Sent",
       detail: `Client sent hire request to ${hireDialog.name}`, entity_type: "job", entity_id: job.id,
    });
    toast({ title: "Hire request sent!", description: `${hireDialog.name} will be notified to accept or reject.` });
    setHireDialog(null);
    setHiring(false);
    navigate("/dashboard/bookings");
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCustomerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, []);

  // Realtime: listen for new job postings and show notification
  useEffect(() => {
    const channel = supabase
      .channel('new-jobs-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
        const newJob = payload.new as any;
        // Show in-app notification
        sonnerToast(t("New Job Posted"), {
          description: `${newJob.title}${newJob.budget ? ` - KSH ${newJob.budget}` : ""}`,
          duration: 8000,
        });

        // Browser push notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(t("New Job Posted"), {
            body: `${newJob.title}${newJob.budget ? ` - KSH ${newJob.budget}` : ""}`,
            icon: "/favicon.ico",
          });
        }
      })
      .subscribe();

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
  }, [t]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: cats } = await supabase.from("service_categories").select("*");
      const { data: workers } = await supabase.from("worker_profiles").select("skills");
      const skillCounts: Record<string, number> = {};
      (workers || []).forEach(w => {
        (w.skills || []).forEach((s: string) => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
      });
      setCategories((cats || []).map(c => ({ ...c, count: skillCounts[c.id] || 0 })));

      const { data: onlineWorkers } = await supabase
        .from("worker_profiles")
        .select("*, profiles!worker_profiles_user_id_fkey(name, avatar_url)")
        .eq("verification_status", "approved");

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

      const skillIds = [...new Set((onlineWorkers || []).flatMap(w => w.skills || []))];
      const { data: skillNames } = skillIds.length > 0
        ? await supabase.from("service_categories").select("id, name").in("id", skillIds)
        : { data: [] };
      const skillMap: Record<string, string> = {};
      (skillNames || []).forEach(s => { skillMap[s.id] = s.name; });

      setNearbyWorkers((onlineWorkers || []).map(w => ({
        ...w,
        name: (w as any).profiles?.name || "Fundi",
        avatar_url: (w as any).profiles?.avatar_url || null,
        skill: (w.skills || []).map((s: string) => skillMap[s] || "").filter(Boolean).join(", ") || t("General"),
        skillIds: w.skills || [],
        rating: ratingMap[w.user_id] ? Math.round(ratingMap[w.user_id].sum / ratingMap[w.user_id].count * 10) / 10 : 0,
        available: w.is_online,
      })));

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

  // Detect completed-but-unpaid jobs to show a dashboard alert
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadUnpaid() {
      const { data: completedJobs } = await supabase
        .from("jobs")
        .select("id, title, budget")
        .eq("customer_id", user!.id)
        .eq("status", "completed");

      const ids = (completedJobs || []).map(j => j.id);
      if (ids.length === 0) {
        if (!cancelled) {
          // If there used to be unpaid jobs and now none, show "thank you"
          setUnpaidJobs(prev => {
            if (prev.length > 0) setShowThanks(true);
            return [];
          });
        }
        return;
      }

      const { data: pmts } = await supabase
        .from("payments")
        .select("job_id, status")
        .in("job_id", ids);
      const paidIds = new Set((pmts || []).filter(p => p.status === "completed").map(p => p.job_id));
      const unpaid = (completedJobs || []).filter(j => !paidIds.has(j.id));
      if (cancelled) return;
      setUnpaidJobs(prev => {
        if (prev.length > 0 && unpaid.length === 0) setShowThanks(true);
        return unpaid;
      });
    }
    loadUnpaid();
    // Refresh whenever payments change
    const channel = supabase
      .channel("customer-payments-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => loadUnpaid())
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `customer_id=eq.${user.id}` }, () => loadUnpaid())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  // Auto-hide the thank-you message after 6s
  useEffect(() => {
    if (!showThanks) return;
    const t = setTimeout(() => setShowThanks(false), 6000);
    return () => clearTimeout(t);
  }, [showThanks]);

  // Filter workers by selected category and search query
  const filteredWorkers = useMemo(() => {
    let list = nearbyWorkers;
    if (selectedCategory !== "all") {
      list = list.filter(w => (w.skillIds || []).includes(selectedCategory));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(w =>
        (w.name || "").toLowerCase().includes(q) ||
        (w.skill || "").toLowerCase().includes(q) ||
        (w.bio || "").toLowerCase().includes(q) ||
        (w.service_area || "").toLowerCase().includes(q) ||
        (w.county || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [nearbyWorkers, selectedCategory, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredWorkers.length / FUNDIS_PER_PAGE);
  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * FUNDIS_PER_PAGE;
    return filteredWorkers.slice(start, start + FUNDIS_PER_PAGE);
  }, [filteredWorkers, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [selectedCategory, searchQuery]);

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    if (km < 10) return `${km.toFixed(1)} km away`;
    return `~${Math.round(km)} km away`;
  };

  const getWorkerDistance = (w: any) => {
    if (!customerPos || !w.latitude || !w.longitude) return null;
    return getDistanceKm(customerPos.lat, customerPos.lng, w.latitude, w.longitude);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const onlineFundis = nearbyWorkers.filter(w => w.available && w.latitude && w.longitude);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("Find Skilled Fundis")}</h1>
          <p className="text-muted-foreground text-sm">{t("Book trusted professionals near you")}</p>
        </div>
        {onlineFundis.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowMap(!showMap)}>
            <MapPin className="w-4 h-4" /> {showMap ? t("Hide Map") : t("Map View")}
          </Button>
        )}
      </div>

      {unpaidJobs.length > 0 && (
        <div className="rounded-xl border border-chart-4/40 bg-chart-4/10 p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-chart-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Finish payment for {unpaidJobs.length === 1 ? "your completed job" : `${unpaidJobs.length} completed jobs`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              {unpaidJobs.slice(0, 2).map(j => j.title).join(", ")}
              {unpaidJobs.length > 2 ? ` and ${unpaidJobs.length - 2} more` : ""} - head to My Bookings to complete the payment.
            </p>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => navigate("/dashboard/bookings")}>
            <CreditCard className="w-4 h-4 mr-1" /> Finish Payment
          </Button>
        </div>
      )}

      {showThanks && unpaidJobs.length === 0 && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Thank you - payment received!</p>
            <p className="text-xs text-muted-foreground mt-0.5">All your completed jobs are now paid.</p>
          </div>
          <button type="button" onClick={() => setShowThanks(false)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative max-w-2xl animate-fade-in">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("What service do you need?")}
          className="pl-12 pr-12 h-14 text-base bg-card border-border rounded-xl"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-lg animate-fade-in" style={{ animationDelay: "100ms" }}>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/post-job")}
          className="h-14 justify-start gap-3 bg-primary/5 border-primary/20 hover:bg-primary/10 text-foreground"
        >
          <FileText className="w-5 h-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium">{t("Post a Job")}</p>
            <p className="text-xs text-muted-foreground">{t("Describe it, fundis apply")}</p>
          </div>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/find-workers")}
          className="h-14 justify-start gap-3 bg-card border-border hover:bg-muted text-foreground"
        >
          <UserCheck className="w-5 h-5 text-chart-3" />
          <div className="text-left">
            <p className="text-sm font-medium">{t("Hire Directly")}</p>
            <p className="text-xs text-muted-foreground">{t("Pick a fundi yourself")}</p>
          </div>
        </Button>
      </div>

      {/* Map View */}
      {showMap && customerPos && onlineFundis.length > 0 && (
        <div className="stat-card animate-fade-in">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> {t("Online Fundis Map")}
          </h3>
          <div className="w-full h-80 rounded-xl overflow-hidden border border-border">
            <MapContainer center={[customerPos.lat, customerPos.lng]} zoom={13} style={{ width: "100%", height: "100%" }} scrollWheelZoom={true}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[customerPos.lat, customerPos.lng]} icon={L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.3)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })}>
                <Popup>{t("You are here")}</Popup>
              </Marker>
              {onlineFundis.map((w) => {
                const dist = getWorkerDistance(w);
                return (
                  <Marker key={w.id} position={[w.latitude, w.longitude]} icon={L.divIcon({ className: "", html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.3)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{w.name}</p>
                        <p className="text-xs">{w.skill}</p>
                        {dist != null && <p className="text-xs text-primary font-medium">{formatDistance(dist)}</p>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}

      <CategoriesScroller
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={(id) => setSelectedCategory(selectedCategory === id ? "all" : id)}
        onClear={() => setSelectedCategory("all")}
        t={t}
      />

      <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t("Available Fundis")}
            <span className="text-sm font-normal text-muted-foreground ml-2">({filteredWorkers.length})</span>
          </h2>
        </div>
        {paginatedWorkers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {paginatedWorkers.map((worker) => {
                const dist = getWorkerDistance(worker);
                return (
                  <div
                    key={worker.id}
                    className="stat-card space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => openWorkerProfile(worker)}
                  >
                    <div className="flex items-center gap-3">
                      {worker.avatar_url ? (
                        <img loading="lazy" decoding="async" src={worker.avatar_url} alt={worker.name} className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                          {worker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{worker.name}</p>
                        <p className="text-xs text-muted-foreground">{worker.skill}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-chart-4">
                        <Star className="w-3 h-3 fill-current" /> {worker.rating > 0 ? worker.rating : t("New")}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full ${worker.available ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                        {worker.available ? t("Online") : t("Offline")}
                      </span>
                    </div>
                    {dist != null && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Navigation className="w-3 h-3" /> {formatDistance(dist)}
                      </div>
                    )}
                    <Button size="sm" className="w-full active:scale-[0.97] transition-transform" onClick={(e) => { e.stopPropagation(); openHireDialog(worker); }}>{t("Hire Now")}</Button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" className="w-9" onClick={() => setCurrentPage(page)}>
                    {page}
                  </Button>
                ))}
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="stat-card flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t("No fundis available right now. Check back soon!")}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: "400ms" }}>
        {[
          { label: t("My Bookings"), value: String(stats.bookings), icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
          { label: t("Total Spent"), value: `KSH ${stats.spent.toLocaleString()}`, icon: CreditCard, color: "text-chart-2", bg: "bg-chart-2/10" },
          { label: t("Avg. Rating Given"), value: stats.avgRating > 0 ? String(stats.avgRating) : "N/A", icon: Star, color: "text-chart-4", bg: "bg-chart-4/10" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{s.label}</p>
                <p className="text-xl sm:text-3xl font-bold text-foreground mt-1 tabular-nums break-all">{s.value}</p>
              </div>
              <div className={`hidden sm:flex w-12 h-12 rounded-xl ${s.bg} items-center justify-center shrink-0`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hire Details Dialog */}
      <Dialog open={!!hireDialog} onOpenChange={(open) => { if (!open) setHireDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("Hire")} {hireDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("Fill in the job details. The fundi will be notified and can accept or reject.")}</p>
            <div className="space-y-2"><Label>{t("Job Title")} *</Label><Input value={hireTitle} onChange={(e) => setHireTitle(e.target.value)} className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>{t("Description")}</Label><Textarea value={hireDescription} onChange={(e) => setHireDescription(e.target.value)} placeholder={t("Describe the work needed...")} className="bg-muted/50" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("Price (KSH)")} *</Label><Input type="number" value={hireBudget} onChange={(e) => setHireBudget(e.target.value)} placeholder="5000" className="bg-muted/50" /></div>
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
