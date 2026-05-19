import { useEffect, useState } from "react";
import { Package, Users, MessageCircle, TrendingUp, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import LatestPostsWidget from "@/components/community/LatestPostsWidget";

const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export default function SupplierDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [fundisRes, clientsRes, suppliersRes, msgsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "worker"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "supplier"),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
      ]);
      setStats([
        { label: "Active Fundis", value: fundisRes.count ?? 0, icon: Users, color: "text-chart-2", bg: "bg-chart-2/10" },
        { label: "Clients on Platform", value: clientsRes.count ?? 0, icon: TrendingUp, color: "text-chart-3", bg: "bg-chart-3/10" },
        { label: "Fellow Suppliers", value: suppliersRes.count ?? 0, icon: Package, color: "text-primary", bg: "bg-primary/10" },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground text-sm">Supplier dashboard - connect with fundis and clients</p>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">{today}</p>
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
            <Button onClick={() => navigate("/dashboard/community")}>Open Community</Button>
            <Button variant="outline" onClick={() => navigate("/dashboard/chat")}>View Chats</Button>
            <Button variant="outline" onClick={() => navigate("/dashboard/account")}>Edit Profile</Button>
          </div>
        </div>
        <LatestPostsWidget />
      </div>
    </div>
  );
}
