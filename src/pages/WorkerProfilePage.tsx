import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileText, Trash2, CheckCircle, Clock, XCircle, Camera } from "lucide-react";

export default function WorkerProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [certName, setCertName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [wpRes, catsRes, profileRes] = await Promise.all([
        supabase.from("worker_profiles").select("*").eq("user_id", user!.id).single(),
        supabase.from("service_categories").select("*").order("name"),
        supabase.from("profiles").select("avatar_url").eq("id", user!.id).single(),
      ]);
      const wp = wpRes.data;
      setAvatarUrl(profileRes.data?.avatar_url || null);
      if (wp) {
        setProfile(wp);
        setBio(wp.bio || "");
        setHourlyRate(wp.hourly_rate?.toString() || "");
        setYearsExperience(wp.years_experience?.toString() || "0");
        setServiceArea(wp.service_area || "");
        setSelectedSkills(wp.skills || []);

        const { data: certsData } = await supabase
          .from("certifications").select("*").eq("worker_id", wp.id)
          .order("created_at", { ascending: false });
        setCerts(certsData || []);
      }
      setCategories(catsRes.data || []);
      setLoading(false);
    }
    load();

    const channel = supabase.channel("worker-profile-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "worker_profiles", filter: `user_id=eq.${user.id}` }, (payload) => {
        setProfile((prev: any) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    const path = `${user.id}/avatar_${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from("certifications").upload(path, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingAvatar(false); return;
    }
    const { data: urlData } = supabase.storage.from("certifications").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", user.id);
    setAvatarUrl(urlData.publicUrl);
    await refreshProfile();
    toast({ title: "Profile photo updated" });
    setUploadingAvatar(false);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from("worker_profiles").update({
      bio, hourly_rate: hourlyRate ? Number(hourlyRate) : null,
      years_experience: yearsExperience ? Number(yearsExperience) : 0,
      service_area: serviceArea || null, skills: selectedSkills,
      verification_status: "pending",
    }).eq("id", profile.id);

    await supabase.from("activity_logs").insert({
      user_id: user!.id, action: "Profile Submitted",
      detail: "Worker submitted/updated profile for review", entity_type: "worker_profile", entity_id: profile.id,
    });
    setProfile((prev: any) => ({ ...prev, verification_status: "pending", bio, hourly_rate: hourlyRate ? Number(hourlyRate) : null }));
    toast({ title: "Profile submitted for review!" });
    setSaving(false);
  };

  const uploadCertification = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile || !certName.trim()) {
      toast({ title: "Please enter a certification name first", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${user!.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("certifications").upload(path, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false); return;
    }
    const { data: urlData } = supabase.storage.from("certifications").getPublicUrl(path);
    await supabase.from("certifications").insert({ worker_id: profile.id, name: certName.trim(), file_url: urlData.publicUrl });
    const { data: updated } = await supabase.from("certifications").select("*").eq("worker_id", profile.id).order("created_at", { ascending: false });
    setCerts(updated || []);
    setCertName("");
    toast({ title: "Certification uploaded" });
    setUploading(false);
  };

  const deleteCert = async (certId: string, fileUrl: string) => {
    const urlParts = fileUrl.split("/certifications/");
    if (urlParts[1]) await supabase.storage.from("certifications").remove([decodeURIComponent(urlParts[1])]);
    await supabase.from("certifications").delete().eq("id", certId);
    setCerts((prev) => prev.filter((c) => c.id !== certId));
    toast({ title: "Certification removed" });
  };

  if (loading) {
    return <div className="space-y-6 max-w-3xl"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;
  }

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    pending: { icon: Clock, color: "text-chart-4", bg: "bg-chart-4/10", label: "Pending Review" },
    approved: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Approved" },
    rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Rejected" },
  };
  const st = statusConfig[profile?.verification_status] || statusConfig.pending;

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "W";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Worker Profile</h1>
          <p className="text-muted-foreground text-sm">Set up your profile to get verified and start receiving jobs</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${st.color} ${st.bg}`}>
          <st.icon className="w-4 h-4" /> {st.label}
        </div>
      </div>

      {/* Profile Photo */}
      <div className="stat-card animate-fade-in flex items-center gap-6">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:opacity-80">
            <Camera className="w-4 h-4" />
            <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} />
          </label>
        </div>
        <div>
          <p className="font-medium text-foreground">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          {uploadingAvatar && <p className="text-xs text-primary mt-1">Uploading...</p>}
        </div>
      </div>

      <div className="stat-card animate-fade-in space-y-4">
        <h3 className="text-lg font-semibold text-foreground">About You</h3>
        <div className="space-y-2">
          <Label>Bio / Description</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell customers about your experience..." className="bg-muted/50 min-h-[100px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Hourly Rate (KSH)</Label><Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="500" className="bg-muted/50" /></div>
          <div className="space-y-2"><Label>Years of Experience</Label><Input type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="5" className="bg-muted/50" /></div>
          <div className="space-y-2"><Label>Service Area</Label><Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Nairobi CBD" className="bg-muted/50" /></div>
        </div>
      </div>

      <div className="stat-card animate-fade-in space-y-4" style={{ animationDelay: "100ms" }}>
        <h3 className="text-lg font-semibold text-foreground">Skills & Services</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => toggleSkill(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 active:scale-[0.97] ${selectedSkills.includes(cat.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {cat.icon} {cat.name}
            </button>
          ))}
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories available yet.</p>}
        </div>
      </div>

      <div className="stat-card animate-fade-in space-y-4" style={{ animationDelay: "200ms" }}>
        <h3 className="text-lg font-semibold text-foreground">Certifications & Documents</h3>
        <p className="text-sm text-muted-foreground">Upload certificates, licenses, or ID documents for verification</p>
        <div className="flex gap-2">
          <Input value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="Certificate name (e.g. Electrical License)" className="bg-muted/50 flex-1" />
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={uploadCertification} />
            <Button asChild variant="outline" disabled={uploading || !certName.trim()}><span><Upload className="w-4 h-4 mr-2" /> {uploading ? "Uploading..." : "Upload"}</span></Button>
          </label>
        </div>
        {certs.length > 0 ? (
          <div className="space-y-2">
            {certs.map((cert) => (
              <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div><p className="text-sm font-medium text-foreground">{cert.name}</p><p className="text-xs text-muted-foreground">{new Date(cert.created_at).toLocaleString()}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  {cert.file_url && <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>}
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => deleteCert(cert.id, cert.file_url || "")}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground py-4 text-center">No certifications uploaded yet</p>}
      </div>

      <Button onClick={saveProfile} disabled={saving} className="active:scale-[0.97]">
        {saving ? "Saving..." : "Save & Submit for Review"}
      </Button>
    </div>
  );
}