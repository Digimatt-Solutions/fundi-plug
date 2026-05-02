import { useEffect, useState } from "react";
import { Users, Briefcase, CreditCard, Wrench, TrendingUp, CheckCircle, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";

const COLORS = ["hsl(22, 93%, 49%)", "hsl(173, 58%, 39%)", "hsl(197, 71%, 53%)", "hsl(43, 96%, 56%)", "hsl(280, 65%, 60%)"];
const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [profilesRes, workersRes, jobsRes, paymentsRes, pendingRes, activeJobsRes, categoriesRes, commRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("worker_profiles").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("payments").select("amount").eq("status", "completed"),
      supabase.from("worker_profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "accepted", "in_progress"]),
      supabase.from("service_categories").select("id, name"),
      supabase.from("payments").select("commission").eq("status", "completed"),
    ]);
    const revenue = (paymentsRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const commission = (commRes.data || []).reduce((sum, p) => sum + Number(p.commission || 0), 0);
    setStats([
      { label: "Total Users", value: profilesRes.count ?? 0, icon: Users, color: "text-chart-3", bg: "bg-chart-3/10" },
      { label: "Active Fundis", value: workersRes.count ?? 0, icon: Wrench, color: "text-chart-2", bg: "bg-chart-2/10" },
      { label: "Jobs Completed", value: jobsRes.count ?? 0, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
      { label: "Revenue", value: `KSH ${revenue.toLocaleString()}`, icon: CreditCard, color: "text-chart-4", bg: "bg-chart-4/10" },
      { label: "Commission", value: `KSH ${commission.toLocaleString()}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
      { label: "Pending Verifications", value: pendingRes.count ?? 0, icon: TrendingUp, color: "text-chart-5", bg: "bg-chart-5/10" },
    ]);
    const cats = categoriesRes.data || [];
    const { data: workerSkills } = await supabase.from("worker_profiles").select("skills");
    const skillCounts: Record<string, number> = {};
    (workerSkills || []).forEach(w => { (w.skills || []).forEach((s: string) => { skillCounts[s] = (skillCounts[s] || 0) + 1; }); });
    setCategoryData(cats.map(c => ({ name: c.name, value: skillCounts[c.id] || 0 })).filter(c => c.value > 0));
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const { data: recentJobs } = await supabase.from("jobs").select("created_at").gte("created_at", sevenDaysAgo.toISOString());
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts: Record<string, number> = {};
    for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - (6 - i)); dayCounts[days[d.getDay()]] = 0; }
    (recentJobs || []).forEach(j => { const day = days[new Date(j.created_at).getDay()]; dayCounts[day] = (dayCounts[day] || 0) + 1; });
    setWeeklyData(Object.entries(dayCounts).map(([day, jobs]) => ({ day, jobs })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("admin-dash-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Dashboard</h1><p className="text-muted-foreground text-sm">FundiPlug platform overview</p></div>
        <p className="text-sm text-muted-foreground hidden md:block">{today}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {(stats || []).map((stat: any, i: number) => (
          <div key={stat.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                <p className="text-xl sm:text-3xl font-bold text-foreground mt-1 tabular-nums break-all">{stat.value}</p>
              </div>
              <div className={`hidden sm:flex w-12 h-12 rounded-xl ${stat.bg} items-center justify-center shrink-0`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card animate-fade-in" style={{ animationDelay: "500ms" }}>
          <div className="flex items-center gap-2 mb-6"><TrendingUp className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Weekly Job Activity</h3></div>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weeklyData}>
                <defs><linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" /><XAxis dataKey="day" stroke="hsl(220, 10%, 46%)" fontSize={12} /><YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} />
                <Area type="monotone" dataKey="jobs" stroke="hsl(22, 93%, 49%)" fill="url(#jobGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No job data yet</div>}
        </div>
        <div className="stat-card animate-fade-in" style={{ animationDelay: "600ms" }}>
          <div className="flex items-center gap-2 mb-6"><Wrench className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Service Categories</h3></div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart><Pie data={categoryData} cx="50%" cy="45%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">{categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} /><Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} /></PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No category data yet</div>}
        </div>
      </div>

      <LatestPostsWidget />
    </div>
  );
}