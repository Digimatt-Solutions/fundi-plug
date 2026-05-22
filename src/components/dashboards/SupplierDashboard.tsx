import { useEffect, useState } from "react";
import { Package, Users, MessageCircle, TrendingUp, Sparkles, ShieldCheck, Clock, XCircle, FileEdit, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";

const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-foreground", icon: FileEdit },
  pending: { label: "Pending Verification", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/15 text-green-700 dark:text-green-400", icon: ShieldCheck },
  rejected: { label: "Rejected", color: "bg-destructive/15 text-destructive", icon: XCircle },
};

export default function SupplierDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any[]>([]);
  const [biz, setBiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [fundisRes, clientsRes, msgsRes, bizRes] = await Promise.all([
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "worker"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
        supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setBiz(bizRes.data);
      const { count: pCount } = await supabase.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", user.id);
      setStats([
        { label: "My Products", value: pCount || 0, icon: Package, color: "text-primary", bg: "bg-primary/10" },
        { label: "Active Fundis", value: fundisRes.count ?? 0, icon: Users, color: "text-chart-2", bg: "bg-chart-2/10" },
        { label: "Clients on Platform", value: clientsRes.count ?? 0, icon: TrendingUp, color: "text-chart-3", bg: "bg-chart-3/10" },
        { label: "Unread Messages", value: msgsRes.count ?? 0, icon: MessageCircle, color: "text-chart-4", bg: "bg-chart-4/10" },
      ]);
      setLoading(false);
    })();
  }, [user]);

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

      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 flex-wrap">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <div key={stat.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
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
        <LatestPostsWidget />
      </div>
    </div>
  );
}
