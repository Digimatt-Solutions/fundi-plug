import { useEffect, useMemo, useState } from "react";
import {
  Package, Users, MessageCircle, TrendingUp, Sparkles,
  ShieldCheck, Clock, XCircle, FileEdit, Store, Eye, Layers, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";

const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-foreground", icon: FileEdit },
  pending: { label: "Pending Verification", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/15 text-green-700 dark:text-green-400", icon: ShieldCheck },
  rejected: { label: "Rejected", color: "bg-destructive/15 text-destructive", icon: XCircle },
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#a78bfa", "#f59e0b"];

export default function SupplierDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any[]>([]);
  const [biz, setBiz] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [fundisRes, clientsRes, msgsRes, bizRes, productsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "worker"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
        supabase.rpc("get_my_business_profile").maybeSingle(),
        supabase.from("supplier_products").select("id, name, category, price, is_active, is_featured, stock_status, created_at").eq("supplier_id", user.id).order("created_at", { ascending: false }),
      ]);
      setBiz(bizRes.data);
      const prods = productsRes.data || [];
      setProducts(prods);
      const active = prods.filter((p) => p.is_active).length;
      setStats([
        { label: "My Products", value: prods.length, sub: `${active} active`, icon: Package, color: "text-primary", bg: "bg-primary/10" },
        { label: "Featured", value: prods.filter((p) => p.is_featured).length, sub: "highlighted in marketplace", icon: Sparkles, color: "text-chart-4", bg: "bg-chart-4/10" },
        { label: "Clients on Platform", value: clientsRes.count ?? 0, sub: "potential buyers", icon: TrendingUp, color: "text-chart-3", bg: "bg-chart-3/10" },
        { label: "Unread Messages", value: msgsRes.count ?? 0, sub: "needs reply", icon: MessageCircle, color: "text-chart-2", bg: "bg-chart-2/10" },
      ]);
      setLoading(false);
    })();
  }, [user]);

  // Build last-30-day timeline
  const timeline = useMemo(() => {
    const days: { date: string; label: string; products: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), products: 0 });
    }
    const idx: Record<string, number> = {};
    days.forEach((d, i) => { idx[d.date] = i; });
    products.forEach((p) => {
      const key = (p.created_at || "").slice(0, 10);
      if (idx[key] !== undefined) days[idx[key]].products += 1;
    });
    return days;
  }, [products]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => { const k = p.category || "Uncategorised"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [products]);

  const stockBreakdown = useMemo(() => {
    const m = { in_stock: 0, low: 0, out_of_stock: 0 } as Record<string, number>;
    products.forEach((p) => { m[p.stock_status] = (m[p.stock_status] || 0) + 1; });
    return m;
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = biz?.verification_status || "draft";
  const meta = statusMeta[status];
  const StatusIcon = meta.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground text-sm">Supplier dashboard - manage your business and products</p>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">{today}</p>
      </div>

      {/* Business banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {biz?.logo_url ? <img src={biz.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"><Store className="w-5 h-5 text-muted-foreground" /></div>}
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{biz?.business_name || "Set up your business profile"}</p>
            <Badge className={`${meta.color} gap-1 mt-1`} variant="outline"><StatusIcon className="w-3 h-3" /> {meta.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/business-profile")}>Business Profile</Button>
          <Button onClick={() => navigate("/dashboard/products")} disabled={status !== "approved"}>Manage Products</Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <div key={stat.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Timeline chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Products listed - last 30 days
              </h2>
              <p className="text-xs text-muted-foreground">Pace of your catalog growth</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">{products.length} total</Badge>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="products" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#prodGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category pie */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-primary" /> Catalog by category
          </h2>
          {categoryData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No products yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Stock health row */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">In stock</p>
            <p className="text-xl font-bold text-foreground">{stockBreakdown.in_stock}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Low stock</p>
            <p className="text-xl font-bold text-foreground">{stockBreakdown.low}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Out of stock</p>
            <p className="text-xl font-bold text-foreground">{stockBreakdown.out_of_stock}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Share product updates, chat with fundis who need supplies, and stay close to the community.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/dashboard/marketplace")}>Browse Marketplace</Button>
          <Button variant="outline" onClick={() => navigate("/dashboard/community")}>Open Community</Button>
          <Button variant="outline" onClick={() => navigate("/dashboard/chat")}>View Chats</Button>
        </div>
      </div>

      {/* Community feed at bottom */}
      <LatestPostsWidget />
    </div>
  );
}
