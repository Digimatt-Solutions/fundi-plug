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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";

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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: wp } = await supabase.from("worker_profiles").select("*").eq("user_id", user!.id).single();
      if (wp) { setIsOnline(wp.is_online); setProfile(wp); }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [completedRes, pendingRes, paymentsRes, reviewsRes, weekRes, msgRes, upcomingRes] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("worker_id", user!.id).eq("status", "completed"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("worker_id", user!.id).eq("status", "pending"),
        supabase.from("payments").select("amount").eq("payee_id", user!.id).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("reviewee_id", user!.id),
        supabase.from("payments").select("amount").eq("payee_id", user!.id).eq("status", "completed").gte("created_at", sevenDaysAgo.toISOString()),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user!.id).is("read_at", null),
        supabase.from("jobs").select("*, profiles!jobs_customer_id_fkey(name)").eq("worker_id", user!.id).in("status", ["pending", "in_progress"]).order("created_at", { ascending: false }).limit(3),
      ]);

      const totalEarnings = (paymentsRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
      const weekEarnings = (weekRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
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
      const dayCounts: Record<string, number> = {};
      const orderedDays: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const k = days[d.getDay()];
        dayCounts[k] = 0;
        orderedDays.push(k);
      }
      (weekRes.data || []).forEach((p: any) => {
        const day = days[new Date(p.created_at).getDay()];
        dayCounts[day] = (dayCounts[day] || 0) + Number(p.amount);
      });
      setEarningsData(orderedDays.map(day => ({ day, amount: dayCounts[day] })));

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
          await supabase.from("worker_profiles").update({
            is_online: true,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }).eq("user_id", user.id);
        },
        async () => {
          await supabase.from("worker_profiles").update({ is_online: true }).eq("user_id", user.id);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      await supabase.from("worker_profiles").update({
        is_online: false,
        latitude: null,
        longitude: null,
      }).eq("user_id", user.id);
    }
  };

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
    { label: t("Total Earnings"), value: `KSH ${stats.earnings.toLocaleString()}`, sub: `+KSH ${stats.weekEarnings.toLocaleString()} this week`, icon: Wallet, gradient: "from-primary/20 via-primary/5 to-transparent", iconBg: "bg-primary/15 text-primary" },
    { label: t("Jobs Completed"), value: String(stats.completed), sub: `${stats.pending} pending`, icon: CheckCircle2, gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent", iconBg: "bg-emerald-500/15 text-emerald-500" },
    { label: t("Average Rating"), value: stats.rating > 0 ? stats.rating.toFixed(1) : "-", sub: `${stats.reviews} reviews`, icon: Star, gradient: "from-amber-500/20 via-amber-500/5 to-transparent", iconBg: "bg-amber-500/15 text-amber-500" },
    { label: t("Pending Jobs"), value: String(stats.pending), sub: t("Awaiting action"), icon: Clock, gradient: "from-sky-500/20 via-sky-500/5 to-transparent", iconBg: "bg-sky-500/15 text-sky-500" },
  ];

  const quickActions = [
    { label: t("Browse Jobs"), icon: Briefcase, to: "/dashboard/my-jobs", color: "text-primary" },
    { label: t("Earnings"), icon: TrendingUp, to: "/dashboard/earnings", color: "text-emerald-500" },
    { label: t("Reviews"), icon: Star, to: "/dashboard/reviews", color: "text-amber-500" },
    { label: t("Messages"), icon: MessageSquare, to: "/dashboard/chat", color: "text-sky-500", badge: unreadMessages },
  ];

  return (
    <div className="space-y-6">
      {/* Hero header - orange shade verification card */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/10 to-orange-200/30 dark:to-orange-900/10 p-5 sm:p-7">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              {profile?.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt={firstName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-primary/40" />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/30 flex items-center justify-center text-primary text-2xl font-bold ring-2 ring-primary/40">
                  {firstName.charAt(0)}
                </div>
              )}
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background ${isOnline ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{t("Hi")}, {firstName}</h1>
                {verified && <span className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">{t("Verified")}</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{isOnline ? t("You're online and discoverable") : t("Go online to start receiving job requests")}</p>
            </div>
          </div>
          <button onClick={toggleOnline}
            className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
              isOnline ? "bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-600" : "bg-foreground/90 text-background hover:bg-foreground"
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
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${stat.gradient} p-4 sm:p-5 animate-fade-in hover:shadow-lg transition-all`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 tabular-nums truncate">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{stat.sub}</p>
              </div>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${stat.iconBg} flex items-center justify-center shrink-0`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Earnings chart */}
      <div className="rounded-2xl border bg-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-foreground">{t("Weekly Earnings")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">KSH {stats.weekEarnings.toLocaleString()} {t("this week")}</p>
          </div>
          <button onClick={() => navigate("/dashboard/earnings")} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            {t("View all")} <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={earningsData}>
            <defs>
              <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 12 }} />
            <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#earnGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Combined Upcoming + Recent Jobs */}
      <div className="rounded-2xl border bg-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> {t("Jobs Overview")}
          </h3>
          <button onClick={() => navigate("/dashboard/my-jobs")} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            {t("View all")} <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {upcomingJobs.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{t("Upcoming")}</p>
            </div>
            <div className="space-y-2">
              {upcomingJobs.map((job) => (
                <button key={job.id} onClick={() => navigate("/dashboard/my-jobs")}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                  <img src={jobImage(job)} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{job.profiles?.name || t("Client")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {job.budget && <p className="text-sm font-semibold text-foreground">KSH {Number(job.budget).toLocaleString()}</p>}
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
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <img src={jobImage(job)} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      {(job as any).profiles?.name || t("Client")}
                      {job.location && <><span>·</span><MapPin className="w-3 h-3" />{job.location}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">{job.budget ? `KSH ${Number(job.budget).toLocaleString()}` : "-"}</p>
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
            <div className="h-32 flex flex-col items-center justify-center text-center text-muted-foreground text-sm gap-2">
              <Briefcase className="w-10 h-10 opacity-30" />
              {t("No jobs yet - go online to start receiving requests")}
            </div>
          )}
        </div>
      </div>

      <LatestPostsWidget />
    </div>
  );
}