import { useEffect, useState } from "react";
import { Briefcase, CreditCard, Star, Clock, ToggleLeft, ToggleRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState({ earnings: 0, completed: 0, rating: 0, pending: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: wp } = await supabase.from("worker_profiles").select("*").eq("user_id", user!.id).single();
      if (wp) setIsOnline(wp.is_online);

      const [completedRes, pendingRes, paymentsRes, reviewsRes] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("worker_id", user!.id).eq("status", "completed"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("worker_id", user!.id).eq("status", "pending"),
        supabase.from("payments").select("amount").eq("payee_id", user!.id).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("reviewee_id", user!.id),
      ]);

      const totalEarnings = (paymentsRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
      const ratings = reviewsRes.data || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

      setStats({
        earnings: totalEarnings,
        completed: completedRes.count ?? 0,
        rating: Math.round(avgRating * 10) / 10,
        pending: pendingRes.count ?? 0,
      });

      const { data: jobs } = await supabase
        .from("jobs")
        .select("*, profiles!jobs_customer_id_fkey(name)")
        .eq("worker_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentJobs(jobs || []);

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const { data: recentPayments } = await supabase
        .from("payments")
        .select("amount, created_at")
        .eq("payee_id", user!.id)
        .eq("status", "completed")
        .gte("created_at", sevenDaysAgo.toISOString());

      const dayCounts: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        dayCounts[days[d.getDay()]] = 0;
      }
      (recentPayments || []).forEach(p => {
        const day = days[new Date(p.created_at).getDay()];
        dayCounts[day] = (dayCounts[day] || 0) + Number(p.amount);
      });
      setEarningsData(Object.entries(dayCounts).map(([day, amount]) => ({ day, amount })));

      setLoading(false);
    }
    load();
  }, [user]);

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await supabase.from("worker_profiles").update({ is_online: newStatus }).eq("user_id", user!.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Earnings", value: `KSH ${stats.earnings.toLocaleString()}`, icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
    { label: "Jobs Completed", value: String(stats.completed), icon: Briefcase, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "Average Rating", value: stats.rating > 0 ? String(stats.rating) : "N/A", icon: Star, color: "text-chart-4", bg: "bg-chart-4/10" },
    { label: "Pending Jobs", value: String(stats.pending), icon: Clock, color: "text-chart-3", bg: "bg-chart-3/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundi Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage your jobs and availability</p>
        </div>
        <button onClick={toggleOnline}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isOnline ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
          }`}
        >
          {isOnline ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={stat.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Earnings</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={earningsData}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis dataKey="day" stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} />
              <Area type="monotone" dataKey="amount" stroke="hsl(22, 93%, 49%)" fill="url(#earnGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: "500ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Jobs</h3>
          {recentJobs.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(job as any).profiles?.name || "Customer"} - {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{job.budget ? `KSH ${job.budget}` : "-"}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      job.status === "completed" ? "bg-green-500/10 text-green-500" :
                      job.status === "in_progress" ? "bg-primary/10 text-primary" :
                      "bg-chart-4/10 text-chart-4"
                    }`}>{job.status.replace("_", " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No jobs yet - set yourself online to start receiving requests</div>
          )}
        </div>
      </div>

      {/* Online Customers */}
      <OnlineCustomers />
    </div>
  );
}

function OnlineCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("profiles").select("id, name, avatar_url, latitude, longitude").eq("is_online" as any, true).not("latitude" as any, "is", null);
      setCustomers(data || []);
    }
    load();
    const channel = supabase.channel("online-customers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (customers.length === 0) return null;

  return (
    <div className="stat-card animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-3">📍 Online Customers Nearby</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {customers.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt={c.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                {c.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "C"}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{c.name}</p>
              <p className="text-xs text-green-500">● Online</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}