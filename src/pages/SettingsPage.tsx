import { useEffect, useState } from "react";
import { Settings, Shield, DollarSign, AlertTriangle, Download, Trash2, ToggleLeft, ToggleRight, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { isSoundEnabled, setSoundEnabled, playNotificationSound } from "@/lib/sound";

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [profileName, setProfileName] = useState("");
  const [phone, setPhone] = useState("");
  const [platformName, setPlatformName] = useState("FundiPlug");
  const [commissionRate, setCommissionRate] = useState("15");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commissionData, setCommissionData] = useState<any[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [flushOpen, setFlushOpen] = useState(false);
  const [flushPassword, setFlushPassword] = useState("");
  const [flushing, setFlushing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [moduleSettings, setModuleSettings] = useState<any[]>([]);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [refreshing, setRefreshing] = useState(false);

  const handleSoundToggle = (v: boolean) => {
    setSoundOn(v);
    setSoundEnabled(v);
    if (v) playNotificationSound();
    toast({ title: v ? "Sounds enabled" : "Sounds muted" });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear caches and force a hard reload to pick up latest deployment
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }
    // Bust query cache by appending a timestamp param then reload
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  };

  useEffect(() => {
    async function load() {
      if (user) {
        setProfileName(user.name);
        setPhone(user.phone || "");
      }
      if (user?.role === "admin") {
        const { data } = await supabase.from("platform_settings").select("key, value");
        (data || []).forEach(s => {
          if (s.key === "platform_name") setPlatformName(s.value);
          if (s.key === "commission_rate") setCommissionRate(s.value);
        });

        const { data: payments } = await supabase.from("payments").select("commission, created_at").eq("status", "completed");
        const total = (payments || []).reduce((s, p) => s + Number(p.commission || 0), 0);
        setTotalCommission(total);

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyComm: Record<string, number> = {};
        for (let i = 0; i < 6; i++) {
          const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
          monthlyComm[months[d.getMonth()]] = 0;
        }
        (payments || []).forEach(p => {
          const m = months[new Date(p.created_at).getMonth()];
          if (monthlyComm[m] !== undefined) monthlyComm[m] += Number(p.commission || 0);
        });
        setCommissionData(Object.entries(monthlyComm).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 })));

        // Load module settings
        const { data: modules } = await supabase.from("module_settings").select("*").order("role").order("label");
        setModuleSettings(modules || []);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ name: profileName, phone }).eq("id", user!.id);
    await refreshProfile();
    toast({ title: "Profile updated" });
    setSaving(false);
  };

  const savePlatformSettings = async () => {
    setSaving(true);
    await supabase.from("platform_settings").upsert([
      { key: "platform_name", value: platformName },
      { key: "commission_rate", value: commissionRate },
    ], { onConflict: "key" });
    toast({ title: "Platform settings saved" });
    setSaving(false);
  };

  const toggleModule = async (id: string, enabled: boolean) => {
    await supabase.from("module_settings").update({ enabled, updated_at: new Date().toISOString() } as any).eq("id", id);
    setModuleSettings(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
    toast({ title: `Module ${enabled ? "enabled" : "disabled"}` });
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const tables = ["profiles", "user_roles", "jobs", "bookings", "payments", "withdrawals", "reviews", "job_applications", "service_categories", "worker_profiles", "activity_logs", "platform_settings", "availability", "certifications", "complaints", "module_settings"] as const;
      const backup: Record<string, any[]> = {};
      for (const table of tables) {
        const { data } = await supabase.from(table).select("*");
        backup[table] = data || [];
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "All data has been exported successfully." });
    } catch (err: any) {
      toast({ title: "Backup failed", description: err.message, variant: "destructive" });
    } finally {
      setBackingUp(false);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user!.email, password: flushPassword });
      if (authError) { toast({ title: "Invalid password", variant: "destructive" }); setFlushing(false); return; }
      const { error } = await supabase.functions.invoke("flush-data", { body: { admin_id: user!.id } });
      if (error) throw error;
      toast({ title: "Data flushed", description: "All records have been cleared except admin accounts." });
      setFlushOpen(false);
      setFlushPassword("");
    } catch (err: any) {
      toast({ title: "Flush failed", description: err.message, variant: "destructive" });
    } finally {
      setFlushing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const workerModules = moduleSettings.filter(m => m.role === "worker");
  const customerModules = moduleSettings.filter(m => m.role === "customer");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and platform settings</p>
      </div>

      <div className="space-y-4">
        {/* Profile */}
        <div className="stat-card animate-fade-in">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Profile</h3>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Display Name</Label><Input value={profileName} onChange={e => setProfileName(e.target.value)} className="bg-muted/50 max-w-sm" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-muted/50 max-w-sm" placeholder="+254 712 345 678" /></div>
            <Button size="sm" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Button>
          </div>
        </div>

        {user?.role === "admin" && (
          <>
            {/* Platform Config */}
            <div className="stat-card animate-fade-in" style={{ animationDelay: "100ms" }}>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Platform Configuration</h3>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Platform Name</Label><Input value={platformName} onChange={e => setPlatformName(e.target.value)} className="bg-muted/50 max-w-sm" /></div>
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <p className="text-xs text-muted-foreground">Percentage deducted from each client payment as platform commission</p>
                  <Input type="number" min="0" max="100" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="bg-muted/50 max-w-sm" />
                </div>
                <Button size="sm" onClick={savePlatformSettings} disabled={saving}>{saving ? "Saving..." : "Save Platform Settings"}</Button>
              </div>
            </div>

            {/* Commission */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="stat-card animate-fade-in" style={{ animationDelay: "200ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" /> Commission Earned</h3>
                  <p className="text-2xl font-bold text-primary">KSH {totalCommission.toLocaleString()}</p>
                </div>
                {commissionData.some(d => d.amount > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={commissionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
                      <XAxis dataKey="month" stroke="hsl(220, 10%, 46%)" fontSize={12} />
                      <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} formatter={(value: any) => [`KSH ${Number(value).toLocaleString()}`, "Commission"]} />
                      <Bar dataKey="amount" fill="hsl(22, 93%, 49%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No commission data yet</div>
                )}
              </div>
              <div className="stat-card animate-fade-in" style={{ animationDelay: "300ms" }}>
                <h3 className="text-lg font-semibold text-foreground mb-4">Commission Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><span className="text-sm text-muted-foreground">Current Rate</span><span className="text-lg font-bold text-foreground">{commissionRate}%</span></div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><span className="text-sm text-muted-foreground">Total Earned</span><span className="text-lg font-bold text-primary">KSH {totalCommission.toLocaleString()}</span></div>
                  <p className="text-xs text-muted-foreground">Commission is automatically deducted from each payment. Fundis receive the remaining amount.</p>
                </div>
              </div>
            </div>

            {/* Module Management */}
            <div className="stat-card animate-fade-in" style={{ animationDelay: "350ms" }}>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <ToggleRight className="w-5 h-5 text-primary" /> Module Management
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Enable or disable modules for Fundi and Client accounts</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Fundi Modules</h4>
                  <div className="space-y-2">
                    {workerModules.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-foreground">{m.label}</span>
                        <Switch checked={m.enabled} onCheckedChange={(v) => toggleModule(m.id, v)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Client Modules</h4>
                  <div className="space-y-2">
                    {customerModules.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-foreground">{m.label}</span>
                        <Switch checked={m.enabled} onCheckedChange={(v) => toggleModule(m.id, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="stat-card animate-fade-in border-destructive/30" style={{ animationDelay: "400ms" }}>
              <h3 className="text-lg font-semibold text-destructive mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">These actions are irreversible. Please proceed with caution.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div><p className="text-sm font-medium text-foreground">Backup All Data</p><p className="text-xs text-muted-foreground">Download a JSON export of all platform data</p></div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBackup} disabled={backingUp}><Download className="w-3.5 h-3.5" /> {backingUp ? "Exporting..." : "Download Backup"}</Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div><p className="text-sm font-medium text-destructive">Flush All Data</p><p className="text-xs text-muted-foreground">Delete all records except admin accounts. Backup first!</p></div>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setFlushOpen(true)}><Trash2 className="w-3.5 h-3.5" /> Flush Data</Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Security */}
        <div className="stat-card animate-fade-in" style={{ animationDelay: "500ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Security</h3>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Email: {user?.email}</p>
            <p className="text-sm text-muted-foreground">Role: <span className="font-medium text-foreground">{user?.role === "worker" ? "Fundi" : user?.role === "customer" ? "Client" : "Admin"}</span></p>
          </div>
        </div>
      </div>

      <Dialog open={flushOpen} onOpenChange={setFlushOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Confirm Data Flush</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-foreground font-medium">This will permanently delete:</p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>All jobs, bookings, and applications</li>
                <li>All payments and withdrawal records</li>
                <li>All reviews and activity logs</li>
                <li>All fundi profiles and certifications</li>
                <li>All non-admin user accounts</li>
              </ul>
              <p className="text-xs text-destructive font-semibold mt-3">Admin accounts will be preserved.</p>
            </div>
            <div className="space-y-2">
              <Label>Enter your admin password to confirm</Label>
              <Input type="password" placeholder="Your password" value={flushPassword} onChange={e => setFlushPassword(e.target.value)} className="bg-muted/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFlushOpen(false); setFlushPassword(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleFlush} disabled={flushing || !flushPassword}>{flushing ? "Flushing..." : "Flush All Data"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
