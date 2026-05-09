import { useEffect, useState, useMemo } from "react";
import { Search, MapPin, Star, Zap, CalendarDays, CreditCard, Briefcase, Navigation, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, X, FileText, UserCheck, CheckCircle, Phone, Mail, Lock, ShieldCheck, Sparkles, ArrowRight, TrendingUp, Heart, Wallet, Eye, Plus, Gift, Activity, Clock, Headphones, Users } from "lucide-react";
import heroFundi from "@/assets/hero-fundi.png";
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
import ChatButton from "@/components/chat/ChatButton";
import ChatPopup, { ChatPeer } from "@/components/chat/ChatPopup";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";
import { MessageCircle } from "lucide-react";

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
  const [activeChatPeer, setActiveChatPeer] = useState<ChatPeer | null>(null);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);
  const [unlockedWorkerIds, setUnlockedWorkerIds] = useState<Set<string>>(new Set());

  // Bookings overview duration + counts
  const [bookingDuration, setBookingDuration] = useState<"week" | "month" | "year">("month");
  const [bookingCounts, setBookingCounts] = useState({ completed: 0, ongoing: 0, upcoming: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState({ avgRating: 4.9, totalClients: 2500 });

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
    // Track profile view (fire-and-forget)
    if (user && worker.user_id && worker.user_id !== user.id) {
      supabase.from("profile_views").insert({ worker_id: worker.user_id, viewer_id: user.id }).then(() => {});
    }
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
        .select("*, profiles!worker_profiles_user_id_fkey(name, avatar_url, email, phone)")
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
        email: (w as any).profiles?.email || "",
        phone: (w as any).profiles?.phone || "",
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

  // Fetch real recent activities for the user
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, detail, created_at, entity_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentActivities(data || []);
    })();
  }, [user]);

  // Fetch booking counts based on selected duration
  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date();
      const since = new Date(now);
      if (bookingDuration === "week") since.setDate(now.getDate() - 7);
      else if (bookingDuration === "month") since.setMonth(now.getMonth() - 1);
      else since.setFullYear(now.getFullYear() - 1);
      const { data } = await supabase
        .from("jobs")
        .select("status, scheduled_at, created_at")
        .eq("customer_id", user.id)
        .gte("created_at", since.toISOString());
      const rows = data || [];
      const completed = rows.filter((j: any) => j.status === "completed").length;
      const ongoing = rows.filter((j: any) => ["accepted", "in_progress"].includes(j.status)).length;
      const upcoming = rows.filter((j: any) => j.status === "pending" || (j.scheduled_at && new Date(j.scheduled_at) > now)).length;
      setBookingCounts({ completed, ongoing, upcoming });
    })();
  }, [user, bookingDuration]);

  // Platform stats for hero card (trust signals)
  useEffect(() => {
    (async () => {
      const [reviewsRes, clientsRes] = await Promise.all([
        supabase.from("reviews").select("rating"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const reviews = reviewsRes.data || [];
      const avg = reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 4.9;
      setPlatformStats({
        avgRating: Math.round(avg * 10) / 10 || 4.9,
        totalClients: clientsRes.count || 2500,
      });
    })();
  }, []);

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
  const firstName = (user?.name || "there").split(" ")[0];
  const trendingCats = categories.slice().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 7);

  return (
    <div className="space-y-5">
      {/* MAIN COLUMN */}
      <div className="space-y-6 min-w-0">

        {unpaidJobs.length > 0 && (
          <div className="rounded-2xl border border-chart-4/40 bg-chart-4/10 p-4 flex items-start gap-3 animate-fade-in">
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
          <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4 flex items-start gap-3 animate-fade-in">
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

        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-orange-50 via-amber-50/40 to-rose-50 dark:from-orange-950/30 dark:via-card dark:to-card px-5 sm:px-8 py-6 sm:py-7 animate-fade-in">
          <div className="absolute -top-16 -right-12 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-amber-300/20 blur-3xl pointer-events-none" />

          <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
            {/* LEFT: copy */}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {t("Find Trusted Fundis,")}<br />
                {t("Get Things")} <span className="text-primary">{t("Done")}</span>
                <Sparkles className="inline w-4 h-4 text-primary ml-1 -mt-3" />
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
                {t("Connect with verified professionals for all your home and business needs.")}
              </p>
            </div>

            {/* RIGHT: fundi image with floating cards */}
            <div className="relative hidden md:block w-[280px] h-[140px] shrink-0">
              <div className="absolute inset-0 flex justify-center items-end">
                <div className="relative w-[150px] h-[140px]">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
                  <img src={heroFundi} alt="Fundi" className="relative w-full h-full object-contain object-bottom" />
                </div>
              </div>
              {/* Avg Rating */}
              <div className="absolute top-1 left-0 bg-card rounded-xl shadow-lg border border-border/60 px-2.5 py-1.5 flex items-center gap-1.5 animate-fade-in">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <div className="leading-tight">
                  <p className="text-xs font-bold text-foreground">{platformStats.avgRating}</p>
                  <p className="text-[9px] text-muted-foreground">{t("Avg rating")}</p>
                </div>
              </div>
              {/* 24/7 Support */}
              <div className="absolute top-3 right-0 bg-card rounded-xl shadow-lg border border-border/60 px-2.5 py-1.5 flex items-center gap-1.5 animate-fade-in">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Headphones className="w-3 h-3" />
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-foreground">24/7</p>
                  <p className="text-[9px] text-muted-foreground">{t("Support")}</p>
                </div>
              </div>
              {/* Trusted by card */}
              <div className="absolute bottom-0 left-2 bg-card rounded-xl shadow-lg border border-border/60 px-2.5 py-1.5 flex items-center gap-2 animate-fade-in">
                <div className="leading-tight">
                  <p className="text-[9px] text-muted-foreground">{t("Trusted by")}</p>
                  <p className="text-[11px] font-bold text-foreground">{platformStats.totalClients.toLocaleString()}+ {t("clients")}</p>
                </div>
                <div className="flex -space-x-1.5">
                  {nearbyWorkers.slice(0, 3).map((w, i) => (
                    <div key={w.id} className="w-5 h-5 rounded-full ring-2 ring-card overflow-hidden bg-muted" style={{ zIndex: 10 - i }}>
                      {w.avatar_url ? <img src={w.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/30" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH BAR - full width */}
          <div className="relative mt-5 w-full bg-card rounded-full border border-border/70 shadow-sm p-1.5 flex items-center gap-1">
            <div className="relative flex-[2] min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("What service do you need?")} className="pl-9 h-10 border-0 bg-transparent focus-visible:ring-0 shadow-none text-sm" />
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="relative flex-1 min-w-0 hidden sm:block">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input placeholder="Nairobi, Kenya" className="pl-9 h-10 border-0 bg-transparent focus-visible:ring-0 shadow-none text-sm" />
            </div>
            <Button className="h-10 px-6 rounded-full shrink-0 text-sm font-semibold">
              {t("Search")}
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 animate-fade-in">
          <button onClick={() => navigate("/dashboard/post-job")} className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 text-left hover:shadow-md hover:border-primary/40 transition-all">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center group-hover:scale-110 transition-transform shrink-0"><FileText className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{t("Post a Job")}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t("Get quotes")}</p>
              </div>
            </div>
          </button>
          <button onClick={() => navigate("/dashboard/find-workers")} className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 text-left hover:shadow-md hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0"><UserCheck className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{t("Hire Directly")}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t("Pick a fundi")}</p>
              </div>
            </div>
          </button>
        </div>

        <CategoriesScroller
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={(id) => setSelectedCategory(selectedCategory === id ? "all" : id)}
          onClear={() => setSelectedCategory("all")}
          t={t}
        />

        {showMap && customerPos && onlineFundis.length > 0 && (
          <div className="rounded-2xl border border-border/70 bg-card p-5 animate-fade-in">
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
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
                      <Popup><div className="text-sm"><p className="font-semibold">{w.name}</p><p className="text-xs">{w.skill}</p>{dist != null && <p className="text-xs text-primary font-medium">{formatDistance(dist)}</p>}</div></Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        )}

        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("Available Fundis")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredWorkers.length} {t("professionals ready to help")}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/dashboard/find-workers")} className="text-xs font-medium text-primary hover:underline">{t("See all")}</button>
              {onlineFundis.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setShowMap(!showMap)}>
                  <MapPin className="w-3.5 h-3.5" /> {showMap ? t("Hide Map") : t("Map")}
                </Button>
              )}
            </div>
          </div>

          {paginatedWorkers.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {paginatedWorkers.map((worker) => {
                  const dist = getWorkerDistance(worker);
                  return (
                    <div key={worker.id} className="group relative rounded-2xl border border-border/60 bg-card overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 transition-all" onClick={() => openWorkerProfile(worker)}>
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0">
                            {worker.avatar_url ? (
                              <img loading="lazy" decoding="async" src={worker.avatar_url} alt={worker.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-background" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center font-semibold">
                                {worker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${worker.available ? "bg-emerald-500" : "bg-gray-400"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                              {worker.name}
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{worker.skill}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); }} className="text-muted-foreground hover:text-rose-500 transition-colors shrink-0" aria-label="Save"><Heart className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-xs">
                          <span className="flex items-center gap-1 font-medium text-foreground"><Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {worker.rating > 0 ? worker.rating : t("New")}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${worker.available ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{worker.available ? t("Online") : t("Offline")}</span>
                        </div>
                        {dist != null && (<div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2"><Navigation className="w-3 h-3" /> {formatDistance(dist)}</div>)}
                        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("From")}</p>
                            <p className="text-sm font-bold text-foreground">{worker.hourly_rate ? `KSH ${worker.hourly_rate}` : "KSH 500"}<span className="text-xs font-normal text-muted-foreground">/hr</span></p>
                          </div>
                          <Button size="sm" className="rounded-full px-4" onClick={(e) => { e.stopPropagation(); openHireDialog(worker); }}>{t("Hire Now")}</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" className="w-9" onClick={() => setCurrentPage(page)}>{page}</Button>
                  ))}
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3"><MapPin className="w-7 h-7 text-muted-foreground" /></div>
              <p className="text-sm font-medium text-foreground">{t("No fundis available right now")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("Check back soon!")}</p>
            </div>
          )}
        </section>

        <LatestPostsWidget />
      </div>

      {/* Worker Profile Dialog */}
      <Dialog open={!!selectedWorker && !hireDialog} onOpenChange={(open) => !open && setSelectedWorker(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedWorker && (() => {
            const dist = getWorkerDistance(selectedWorker);
            const unlocked = unlockedWorkerIds.has(selectedWorker.user_id);
            const phoneShown = unlocked ? selectedWorker.phone : maskPhone(selectedWorker.phone);
            const emailShown = unlocked ? (selectedWorker as any).email : maskEmail((selectedWorker as any).email);
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
                      <p className="text-sm text-muted-foreground font-normal">{selectedWorker.skill || t("General")}</p>
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
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm text-foreground"><span className="font-medium">{t("Certified by Digimatt")}</span> - {t("This fundi has been vetted and approved.")}</p>
                  </div>
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
                  <div className="space-y-2 text-sm">
                    {selectedWorker.phone && (
                      <div className="flex items-center gap-2 text-foreground">
                        {unlocked ? <Phone className="w-3.5 h-3.5 text-muted-foreground" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        {phoneShown}
                      </div>
                    )}
                    {(selectedWorker as any).email && (
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
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="w-full" onClick={() => openHireDialog(selectedWorker)}>
                      <Briefcase className="w-4 h-4 mr-2" /> {t("Hire This Fundi")}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveChatPeer({ id: selectedWorker.user_id, name: selectedWorker.name, avatar_url: selectedWorker.avatar_url })}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" /> {t("Chat")}
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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

      {activeChatPeer && (
        <ChatPopup peer={activeChatPeer} onClose={() => setActiveChatPeer(null)} />
      )}
    </div>
  );
}
