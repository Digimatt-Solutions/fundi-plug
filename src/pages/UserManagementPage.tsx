import { useEffect, useState } from "react";
import { Users, Search, MoreVertical, Shield, Wrench, User, Ban, Trash2, UserCog, ShieldCheck, Crown, Package, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AssetImage } from "@/components/AssetImage";

const roleIcon = (role: string) => {
  if (role === "admin") return <Shield className="w-3.5 h-3.5" />;
  if (role === "worker") return <Wrench className="w-3.5 h-3.5" />;
  if (role === "supplier") return <Package className="w-3.5 h-3.5" />;
  return <User className="w-3.5 h-3.5" />;
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [roleDialog, setRoleDialog] = useState<any>(null);
  const [newRole, setNewRole] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [promoteDialog, setPromoteDialog] = useState<any>(null);
  const [emailDialog, setEmailDialog] = useState<any>(null);
  const [newEmail, setNewEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [superAdminId, setSuperAdminId] = useState<string | null>(null);
  const isCallerSuper = !!currentUser?.id && currentUser.id === superAdminId;

  async function loadUsers() {
    const { data: profilesRaw } = await supabase.rpc("admin_list_profiles");
    const profiles = (profilesRaw || []).slice().sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
    if (!profiles.length) { setLoading(false); return; }

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: workerProfiles } = await supabase.from("worker_profiles").select("user_id, verification_status");

    const roleMap: Record<string, string> = {};
    (roles || []).forEach(r => { roleMap[r.user_id] = r.role; });
    const wpMap: Record<string, string> = {};
    (workerProfiles || []).forEach(w => { wpMap[w.user_id] = w.verification_status; });

    setUsers(profiles.map(p => ({
      ...p,
      role: roleMap[p.id] || "customer",
      verificationStatus: wpMap[p.id] || null,
      status: !(p as any).is_active ? "Inactive" :
        roleMap[p.id] === "worker" ? (wpMap[p.id] === "approved" ? "Active" : wpMap[p.id] === "pending" ? "Pending" : "Rejected") : "Active",
    })));
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
    // Determine the super admin (first admin by earliest profile creation)
    (async () => {
      const { data } = await supabase.rpc("get_super_admin_id");
      if (data) setSuperAdminId(data as unknown as string);
    })();
    // Realtime subscription
    const channel = supabase.channel("user-mgmt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadUsers())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => loadUsers())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => loadUsers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const callAdminApi = async (body: any) => {
    setActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-manage-user", {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setActionLoading(false);
    if (res.error || res.data?.error) {
      toast({ title: "Error", description: res.data?.error || res.error?.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleChangeRole = async () => {
    if (!roleDialog || !newRole) return;
    const ok = await callAdminApi({ action: "change_role", userId: roleDialog.id, newRole });
    if (ok) { toast({ title: "Role updated" }); setRoleDialog(null); loadUsers(); }
  };

  const handleToggleActive = async (u: any) => {
    const newActive = u.status === "Inactive";
    const ok = await callAdminApi({ action: "toggle_active", userId: u.id, isActive: newActive });
    if (ok) { toast({ title: newActive ? "User activated" : "User deactivated" }); loadUsers(); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    const ok = await callAdminApi({ action: "delete_user", userId: deleteDialog.id });
    if (ok) { toast({ title: "User deleted permanently" }); setDeleteDialog(null); loadUsers(); }
  };

  const handlePromote = async () => {
    if (!promoteDialog) return;
    const ok = await callAdminApi({ action: "promote_to_admin", userId: promoteDialog.id });
    if (ok) {
      toast({
        title: "Promoted to Admin",
        description: `${promoteDialog.name} now has administrator access.`,
      });
      setPromoteDialog(null);
      loadUsers();
    }
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
          <p className="text-muted-foreground text-sm">Manage platform users, roles, and access</p>
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
              {filtered.length > 0 ? (["admin", "worker", "supplier", "customer"] as const).flatMap((roleKey) => {
                const group = filtered.filter(u => u.role === roleKey);
                if (group.length === 0) return [];
                const label = roleKey === "worker" ? "Fundis" : roleKey === "customer" ? "Clients" : roleKey === "supplier" ? "Suppliers" : "Admins";
                return [
                  <tr key={`hdr-${roleKey}`} className="bg-primary/5 border-b border-border">
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-2">
                      {roleIcon(roleKey)} {label} <span className="text-muted-foreground font-normal normal-case">({group.length})</span>
                    </td>
                  </tr>,
                  ...group.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <AssetImage src={u.avatar_url} bucket="avatars" alt={u.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-border" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {u.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          {u.name}
                          {u.id === superAdminId && (
                            <span title="Super Admin" className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              <Crown className="w-3 h-3" /> Super
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted">
                      {roleIcon(u.role)} {u.role === "worker" ? "Fundi" : u.role === "customer" ? "Client" : u.role === "supplier" ? "Supplier" : "Admin"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.status === "Active" ? "bg-green-500/10 text-green-500" :
                      u.status === "Pending" ? "bg-chart-4/10 text-chart-4" :
                      u.status === "Inactive" ? "bg-muted text-muted-foreground" :
                      "bg-destructive/10 text-destructive"
                    }`}>{u.status}</span>
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="p-4">
                    {u.id !== currentUser?.id && (() => {
                      const targetIsSuper = u.id === superAdminId;
                      // Non-super admins cannot act on the super admin at all
                      if (targetIsSuper && !isCallerSuper) {
                        return (
                          <span className="text-xs text-muted-foreground italic">Protected</span>
                        );
                      }
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setRoleDialog(u); setNewRole(u.role); }}>
                              <UserCog className="w-4 h-4 mr-2" /> Change Role
                            </DropdownMenuItem>
                            {u.role !== "admin" && (
                              <DropdownMenuItem onClick={() => setPromoteDialog(u)}>
                                <ShieldCheck className="w-4 h-4 mr-2" /> Promote to Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                              <Ban className="w-4 h-4 mr-2" /> {u.status === "Inactive" ? "Activate" : "Deactivate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteDialog(u)} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
                  </td>
                </tr>
                  ))
                ];
              }) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Role for {roleDialog?.name}</DialogTitle></DialogHeader>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="worker">Fundi</SelectItem>
              <SelectItem value="customer">Client</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={actionLoading}>{actionLoading ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {deleteDialog?.name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action is permanent and cannot be undone. All user data will be removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>{actionLoading ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Admin Dialog */}
      <Dialog open={!!promoteDialog} onOpenChange={(o) => !o && setPromoteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Promote {promoteDialog?.name} to Admin?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This will grant <strong>{promoteDialog?.name}</strong> full administrator access. They will see the admin dashboard the next time they sign in - no email verification required.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialog(null)}>Cancel</Button>
            <Button onClick={handlePromote} disabled={actionLoading}>
              {actionLoading ? "Promoting..." : "Promote to Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
