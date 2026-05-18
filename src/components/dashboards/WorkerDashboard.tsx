import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CreditCard, Star, Clock, Power, TrendingUp, Wallet, MessageSquare, Calendar, ArrowUpRight, MapPin, CheckCircle2 } from "lucide-react";

const JOB_IMAGES: Record<string, string> = {
  plumb: "https://images.unsplash.com/photo-1606613734004-37ad8fbe9e2d?w=200&h=200&fit=crop",
  electric: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200&h=200&fit=crop",
  clean: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=200&h=200&fit=crop",
  paint: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=200&h=200&fit=crop",
  carpen: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200&h=200&fit=crop",
  garden: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&h=200&fit=crop",
  mason: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop",
  weld: "https://images.unsplash.com/photo-1567789884554-0b844b597180?w=200&h=200&fit=crop",
  car: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200&h=200&fit=crop",
  mov: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200&h=200&fit=crop",
  default: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=200&h=200&fit=crop",
};
function jobImage(job: any): string {
  const key = `${job.title || ""} ${job.category || ""}`.toLowerCase();
  for (const k of Object.keys(JOB_IMAGES)) if (k !== "default" && key.includes(k)) return JOB_IMAGES[k];
  return JOB_IMAGES.default;
}
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EarningsRange = "7d" | "30d" | "90d" | "12m" | "all";

export default function WorkerDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ earnings: 0, completed: 0, rating: 0, pending: 0, reviews: 0, weekEarnings: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [range, setRange] = useState<EarningsRange>("30d");
  const [jobsData, setJobsData] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: wp } = await supabase.from("worker_profiles").select("*").eq("user_id", user!.id).single();
      if (wp) { setIsOnline(wp.is_online); setProfile(wp); }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [completedRes, pendingRes, paymentsRes, reviewsRes, allCompletedRes, msgRes, upcomingRes] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("worker_id", user!.id).eq("status", "completed"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("worker_id", user!.id).eq("status", "pending"),
        supabase.from("payments").select("amount").eq("payee_id", user!.id).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("reviewee_id", user!.id),
        supabase.from("payments").select("amount, created_at").eq("payee_id", user!.id).eq("status", "completed").order("created_at", { ascending: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user!.id).is("read_at", null),
        supabase.from("jobs").select("*, profiles!jobs_customer_id_fkey(name)").eq("worker_id", user!.id).in("status", ["pending", "in_progress"]).order("created_at", { ascending: false }).limit(3),
      ]);

      const totalEarnings = (paymentsRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
      const weekEarnings = (allCompletedRes.data || [])
        .filter((p: any) => new Date(p.created_at) >= sevenDaysAgo)
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      setAllPayments(allCompletedRes.data || []);
      const ratings = reviewsRes.data || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

      setStats({
        earnings: totalEarnings,
        completed: completedRes.count ?? 0,
        rating: Math.round(avgRating * 10) / 10,
        pending: pendingRes.count ?? 0,
        reviews: ratings.length,
        weekEarnings,
      });
      setUnreadMessages(msgRes.count ?? 0);
      setUpcomingJobs(upcomingRes.data || []);

      const { data: jobs } = await supabase
        .from("jobs")
        .select("*, profiles!jobs_customer_id_fkey(name)")
        .eq("worker_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentJobs(jobs || []);

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const orderedDays: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        orderedDays.push(days[d.getDay()]);
      }

      const { data: weekJobs } = await supabase.from("jobs").select("created_at").eq("worker_id", user!.id).gte("created_at", sevenDaysAgo.toISOString());
      const jobDayCounts: Record<string, number> = {};
      orderedDays.forEach(d => { jobDayCounts[d] = 0; });
      (weekJobs || []).forEach((j: any) => {
        const day = days[new Date(j.created_at).getDay()];
        jobDayCounts[day] = (jobDayCounts[day] || 0) + 1;
      });
      setJobsData(orderedDays.map(day => ({ day, jobs: jobDayCounts[day] })));

      setLoading(false);
    }
    load();
  }, [user]);

  const toggleOnline = async () => {
    if (!user) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    if (newStatus && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await Promise.all([
            supabase.from("worker_profiles").update({ is_online: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }).eq("user_id", user.id),
            supabase.from("profiles").update({ is_online: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }).eq("id", user.id),
          ]);
        },
        async () => {
          await Promise.all([
            supabase.from("worker_profiles").update({ is_online: true }).eq("user_id", user.id),
            supabase.from("profiles").update({ is_online: true }).eq("id", user.id),
          ]);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      await Promise.all([
        supabase.from("worker_profiles").update({ is_online: false, latitude: null, longitude: null }).eq("user_id", user.id),
        supabase.from("profiles").update({ is_online: false }).eq("id", user.id),
      ]);
    }
  };

  // Bucket earnings data based on selected range
  useEffect(() => {
    const now = new Date();
    const buckets: { label: string; amount: number }[] = [];
    const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const fmtMonth = (d: Date) => d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

    if (range === "7d" || range === "30d") {
      const days = range === "7d" ? 7 : 30;
      const map: Record<string, number> = {};
      const order: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        map[key] = 0; order.push(key);
      }
      allPayments.forEach((p: any) => {
        const d = new Date(p.created_at); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        if (key in map) map[key] += Number(p.amount);
      });
      order.forEach((k) => buckets.push({ label: fmtDay(new Date(k)), amount: map[k] }));
    } else if (range === "90d") {
      const map: Record<string, number> = {};
      const order: string[] = [];
      for (let i = 12; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i * 7); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        map[key] = 0; order.push(key);
      }
      const startKeys = order.map((k) => new Date(k).getTime());
      allPayments.forEach((p: any) => {
        const t = new Date(p.created_at).getTime();
        for (let i = startKeys.length - 1; i >= 0; i--) {
          if (t >= startKeys[i]) { map[order[i]] += Number(p.amount); break; }
        }
      });
      order.forEach((k) => buckets.push({ label: fmtDay(new Date(k)), amount: map[k] }));
    } else if (range === "12m") {
      const map: Record<string, number> = {};
      const order: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        map[key] = 0; order.push(key);
      }
      allPayments.forEach((p: any) => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key in map) map[key] += Number(p.amount);
      });
      order.forEach((k) => {
        const [y, m] = k.split("-").map(Number);
        buckets.push({ label: fmtMonth(new Date(y, m, 1)), amount: map[k] });
      });
    } else {
      if (allPayments.length === 0) {
        buckets.push({ label: fmtMonth(now), amount: 0 });
      } else {
        const sorted = [...allPayments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const first = new Date(sorted[0].created_at);
        const map: Record<string, number> = {};
        const order: string[] = [];
        const cur = new Date(first.getFullYear(), first.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        while (cur <= end) {
          const key = `${cur.getFullYear()}-${cur.getMonth()}`;
          map[key] = 0; order.push(key);
          cur.setMonth(cur.getMonth() + 1);
        }
        allPayments.forEach((p: any) => {
          const d = new Date(p.created_at);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (key in map) map[key] += Number(p.amount);
        });
        order.forEach((k) => {
          const [y, m] = k.split("-").map(Number);
          buckets.push({ label: fmtMonth(new Date(y, m, 1)), amount: map[k] });
        });
      }
    }
    setEarningsData(buckets);
  }, [allPayments, range]);

  // Realtime: keep local toggle in sync if profile updates elsewhere
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wp-online-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "worker_profiles", filter: `user_id=eq.${user.id}` },
        (p: any) => setIsOnline(!!p.new?.is_online))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name || user?.name?.split(" ")[0] || "Fundi";
  const verified = profile?.verification_status === "approved";

  const statCards = [
    { label: t("Total Earnings"), value: `KSH ${stats.earnings.toLocaleString()}`, sub: `+KSH ${stats.weekEarnings.toLocaleString()} this week`, icon: Wallet, iconBg: "bg-primary/15 text-primary" },
    { label: t("Jobs Completed"), value: String(stats.completed), sub: `${stats.pending} pending`, icon: CheckCircle2, iconBg: "bg-emerald-500/15 text-emerald-500" },
    { label: t("Average Rating"), value: stats.rating > 0 ? stats.rating.toFixed(1) : "-", sub: `${stats.reviews} reviews`, icon: Star, iconBg: "bg-amber-500/15 text-amber-500" },
    { label: t("Pending Jobs"), value: String(stats.pending), sub: t("Awaiting action"), icon: Clock, iconBg: "bg-sky-500/15 text-sky-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero header - full brand orange */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7" style={{ backgroundColor: "#f37021" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              {profile?.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt={`${firstName} fundi profile photo`} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-white/60" />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/25 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-white/60">
                  {firstName.charAt(0)}
                </div>
              )}
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${isOnline ? "bg-emerald-500" : "bg-gray-400"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{t("Hi")}, {firstName}</h1>
                {verified && <span className="text-[10px] uppercase tracking-wide bg-white text-[#f37021] px-2 py-0.5 rounded-full font-semibold">{t("Verified")}</span>}
              </div>
              <p className="text-sm text-white/90 mt-0.5">{isOnline ? t("You're online and discoverable") : t("Go online to start receiving job requests")}</p>
            </div>
          </div>
          <button onClick={toggleOnline}
            className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
              isOnline ? "bg-emerald-500 text-white shadow-emerald-600/40 hover:bg-emerald-600" : "bg-white text-[#f37021] hover:bg-white/90"
            }`}
          >
            <Power className="w-4 h-4" />
            {isOnline ? t("Online") : t("Go Online")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, i) => (
          <div key={stat.label}
            className="relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5 animate-fade-in hover:shadow-lg transition-all"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground mt-1.5 tabular-nums break-words leading-tight">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">{stat.sub}</p>
              </div>
              <div className={`hidden sm:flex w-10 h-10 lg:w-11 lg:h-11 rounded-xl ${stat.iconBg} items-center justify-center shrink-0`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("Weekly Earnings")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">KSH {stats.weekEarnings.toLocaleString()} {t("this week")}</p>
            </div>
            <button onClick={() => navigate("/dashboard/earnings")} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              {t("View all")} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={earningsData} margin={{ left: -20, right: 0, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--primary) / 0.2)" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={{ stroke: "hsl(var(--primary))", strokeWidth: 2.5 }}
                tickLine={false}
                width={40}
              />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 12 }} />
              <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#earnGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Jobs Overview replaces Weekly Jobs */}
        <div className="rounded-2xl border bg-card p-5 animate-fade-in flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" /> {t("Jobs Overview")}
            </h2>
            <button onClick={() => navigate("/dashboard/my-jobs")} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              {t("View all")} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[260px] pr-1 space-y-4">
            {upcomingJobs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{t("Upcoming")}</p>
                </div>
                <div className="space-y-2">
                  {upcomingJobs.map((job) => (
                    <button key={job.id} onClick={() => navigate("/dashboard/my-jobs")}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <img src={jobImage(job)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{job.profiles?.name || t("Client")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {job.budget && <p className="text-xs font-semibold text-foreground">KSH {Number(job.budget).toLocaleString()}</p>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${
                          job.status === "in_progress" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600"
                        }`}>{job.status.replace("_", " ")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{t("Recent")}</p>
              </div>
              {recentJobs.length > 0 ? (
                <div className="space-y-2">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                      <img src={jobImage(job)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          {(job as any).profiles?.name || t("Client")}
                          {job.location && <><span>·</span><MapPin className="w-3 h-3" />{job.location}</>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-foreground">{job.budget ? `KSH ${Number(job.budget).toLocaleString()}` : "-"}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                          job.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                          job.status === "in_progress" ? "bg-primary/10 text-primary" :
                          "bg-amber-500/10 text-amber-600"
                        }`}>{job.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-24 flex flex-col items-center justify-center text-center text-muted-foreground text-sm gap-2">
                  <Briefcase className="w-8 h-8 opacity-30" />
                  {t("No jobs yet")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LatestPostsWidget />
    </div>
  );
}