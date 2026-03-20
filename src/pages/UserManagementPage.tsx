import { useEffect, useState } from "react";
import { Users, Search, MoreVertical, Shield, Wrench, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const roleIcon = (role: string) => {
  if (role === "admin") return <Shield className="w-3.5 h-3.5" />;
  if (role === "worker") return <Wrench className="w-3.5 h-3.5" />;
  return <User className="w-3.5 h-3.5" />;
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function loadUsers() {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) { setLoading(false); return; }

    const userIds = profiles.map(p => p.id);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: workerProfiles } = await supabase.from("worker_profiles").select("user_id, verification_status");

    const roleMap: Record<string, string> = {};
    (roles || []).forEach(r => { roleMap[r.user_id] = r.role; });
    const wpMap: Record<string, string> = {};
    (workerProfiles || []).forEach(w => { wpMap[w.user_id] = w.verification_status; });

    setUsers(profiles.map(p => ({
      ...p,
      role: roleMap[p.id] || "customer",
      status: roleMap[p.id] === "worker" ? (wpMap[p.id] === "approved" ? "Active" : wpMap[p.id] === "pending" ? "Pending" : "Rejected") : "Active",
    })));
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteUser = async (userId: string) => {
    // Only admins can see this page, delete via activity log
    toast({ title: "User deletion requires backend admin action", description: "Contact system administrator." });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 max-w-sm" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm">Manage platform users and roles</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="stat-card overflow-hidden p-0 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 text-muted-foreground font-medium">User</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Role</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Joined</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted capitalize">
                      {roleIcon(u.role)} {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.status === "Active" ? "bg-green-500/10 text-green-500" :
                      u.status === "Pending" ? "bg-chart-4/10 text-chart-4" :
                      "bg-destructive/10 text-destructive"
                    }`}>{u.status}</span>
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDeleteUser(u.id)}>Remove User</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
