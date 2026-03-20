import { useEffect, useState } from "react";
import { Settings, Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [profileName, setProfileName] = useState("");
  const [phone, setPhone] = useState("");
  const [platformName, setPlatformName] = useState("SkillHub");
  const [commissionRate, setCommissionRate] = useState("15");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    await supabase.from("platform_settings").update({ value: platformName }).eq("key", "platform_name");
    await supabase.from("platform_settings").update({ value: commissionRate }).eq("key", "commission_rate");
    toast({ title: "Platform settings saved" });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and platform settings</p>
      </div>

      <div className="space-y-4">
        {/* Profile */}
        <div className="stat-card animate-fade-in">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> Profile
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-muted/50 max-w-sm" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-muted/50 max-w-sm" placeholder="+1 234 567 890" />
            </div>
            <Button size="sm" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>

        {/* Admin: Platform Settings */}
        {user?.role === "admin" && (
          <div className="stat-card animate-fade-in" style={{ animationDelay: "100ms" }}>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Platform
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Platform Name</Label>
                <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} className="bg-muted/50 max-w-sm" />
              </div>
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className="bg-muted/50 max-w-sm" />
              </div>
              <Button size="sm" onClick={savePlatformSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Platform Settings"}
              </Button>
            </div>
          </div>
        )}

        {/* Security */}
        <div className="stat-card animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Security
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Email: {user?.email}</p>
            <p className="text-sm text-muted-foreground">Role: <span className="capitalize font-medium text-foreground">{user?.role}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
