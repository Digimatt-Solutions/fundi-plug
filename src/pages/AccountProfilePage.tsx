import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Camera, Mail, Phone, MapPin, ShieldCheck, User as UserIcon, KeyRound, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import FingerprintEnroll from "@/components/FingerprintEnroll";

export default function AccountProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    avatar_url: "",
    address: "",
  });
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("name, phone, email, avatar_url, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || user.email,
          avatar_url: data.avatar_url || "",
          address: "",
        });
        setMemberSince(data.created_at);
      }
      setLoading(false);
    })();
  }, [user]);

  const onPickAvatar = () => fileRef.current?.click();

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setForm((f) => ({ ...f, avatar_url: url }));
      await refreshProfile();
      toast({ title: "Profile photo updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: form.name.trim(), phone: form.phone.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profile saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const initials = (form.name || form.email || "?").slice(0, 2).toUpperCase();
  const roleLabel = user?.role === "admin" ? "Administrator" : "Client";

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
        <CardContent className="p-4 sm:p-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-4 ring-background shadow-md">
                <AvatarImage src={form.avatar_url} alt={form.name} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={onPickAvatar}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-2 shadow hover:opacity-90 transition disabled:opacity-50"
                aria-label={t("Change photo")}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">
                  {form.name || "Unnamed"}
                </h1>
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="w-3 h-3" /> {roleLabel}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{form.email}</p>
              {memberSince && (
                <p className="text-xs text-muted-foreground mt-1">
                  Member since {new Date(memberSince).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-primary" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("Full name")}</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("Jane Doe")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("+254 712 345 678")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label>
              <Input id="email" value={form.email} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">{t("Email cannot be changed from this page.")}</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">{t("New password")}</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("At least 6 characters")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t("Confirm password")}</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("Re-enter password")} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={changePassword} disabled={pwSaving || !newPassword}>
              {pwSaving ? "Updating..." : "Update password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <FingerprintEnroll />
    </div>
  );
}
