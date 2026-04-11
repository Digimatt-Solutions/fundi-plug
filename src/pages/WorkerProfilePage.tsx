import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Trash2, CheckCircle, Clock, XCircle, Camera, AlertTriangle } from "lucide-react";

const REQUIRED_DOCS = [
  { key: "national_id", label: "National ID", description: "Upload a copy of your National ID (front)" },
  { key: "nca_document", label: "NCA Document", description: "National Construction Authority certificate" },
];
const LICENSE_DOCS = [
  { key: "good_conduct", label: "Certificate of Good Conduct", description: "Police clearance certificate" },
];
const ACADEMIC_DOCS = [
  { key: "academic", label: "Academic Certificate", description: "Diploma, degree, or trade certificate" },
];

const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa","Homa Bay","Isiolo","Kajiado",
  "Kakamega","Kericho","Kiambu","Kilifi","Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia",
  "Lamu","Machakos","Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a","Nairobi",
  "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya","Taita-Taveta","Tana River",
  "Tharaka-Nithi","Trans Nzoia","Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot",
];

const PLATFORM_RULES = [
  "I agree to provide accurate and truthful information in my profile.",
  "I understand that my documents will be verified before I can receive jobs.",
  "I agree to maintain professional conduct with all customers.",
  "I agree to the platform's commission and payment terms.",
  "I understand that violations may lead to account suspension or termination.",
];

export default function WorkerProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

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
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [county, setCounty] = useState("");
  const [constituency, setConstituency] = useState("");
  const [ward, setWard] = useState("");

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
        setGender((wp as any).gender || "");
        setDob((wp as any).date_of_birth || "");
        setIdNumber((wp as any).id_number || "");
        setCountry((wp as any).country || "Kenya");
        setCounty((wp as any).county || "");
        setConstituency((wp as any).constituency || "");
        setWard((wp as any).ward || "");
        const { data: certsData } = await supabase.from("certifications").select("*").eq("worker_id", wp.id).order("created_at", { ascending: false });
        setCerts(certsData || []);
      }
      setCategories(catsRes.data || []);
      setLoading(false);
    }
    load();
    const channel = supabase.channel("worker-profile-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "worker_profiles", filter: `user_id=eq.${user.id}` }, (payload) => {
        setProfile((prev: any) => prev ? { ...prev, ...payload.new } : prev);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const toggleSkill = (id: string) => setSelectedSkills(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    const path = `${user.id}/avatar_${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from("certifications").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("certifications").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", user.id);
    setAvatarUrl(urlData.publicUrl);
    await refreshProfile();
    toast({ title: "Profile photo updated" });
    setUploadingAvatar(false);
  };

  const hasRequiredDocs = () => {
    const certNames = certs.map(c => c.name.toLowerCase());
    return REQUIRED_DOCS.every(doc => certNames.some(name => name.includes(doc.key.replace("_", " ")) || name.includes(doc.label.toLowerCase())));
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!consentChecked) { toast({ title: "Please accept the platform terms", variant: "destructive" }); return; }
    if (!hasRequiredDocs()) { toast({ title: "Required documents missing", description: "Please upload your National ID and NCA Document.", variant: "destructive" }); return; }
    setSaving(true);
    await supabase.from("worker_profiles").update({
      bio, hourly_rate: hourlyRate ? Number(hourlyRate) : null,
      years_experience: yearsExperience ? Number(yearsExperience) : 0,
      service_area: serviceArea || null, skills: selectedSkills,
      gender: gender || null, date_of_birth: dob || null,
      id_number: idNumber || null, country: country || "Kenya",
      county: county || null, constituency: constituency || null,
      ward: ward || null, verification_status: "pending",
    } as any).eq("id", profile.id);
    await supabase.from("activity_logs").insert({
      user_id: user!.id, action: "Profile Submitted",
      detail: "Fundi submitted/updated profile for review", entity_type: "worker_profile", entity_id: profile.id,
    });
    setProfile((prev: any) => ({ ...prev, verification_status: "pending" }));
    toast({ title: "Profile submitted for review!" });
    setSaving(false);
  };

  const uploadDoc = async (docKey: string, docLabel: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(docKey);
    const path = `${user!.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("certifications").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); setUploading(null); return; }
    const { data: urlData } = supabase.storage.from("certifications").getPublicUrl(path);
    await supabase.from("certifications").insert({ worker_id: profile.id, name: docLabel, file_url: urlData.publicUrl });
    const { data: updated } = await supabase.from("certifications").select("*").eq("worker_id", profile.id).order("created_at", { ascending: false });
    setCerts(updated || []);
    toast({ title: `${docLabel} uploaded` });
    setUploading(null);
  };

  const uploadCertification = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile || !certName.trim()) { toast({ title: "Please enter a certification name first", variant: "destructive" }); return; }
    setUploading("custom");
    const path = `${user!.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("certifications").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); setUploading(null); return; }
    const { data: urlData } = supabase.storage.from("certifications").getPublicUrl(path);
    await supabase.from("certifications").insert({ worker_id: profile.id, name: certName.trim(), file_url: urlData.publicUrl });
    const { data: updated } = await supabase.from("certifications").select("*").eq("worker_id", profile.id).order("created_at", { ascending: false });
    setCerts(updated || []);
    setCertName("");
    toast({ title: "Certification uploaded" });
    setUploading(null);
  };

  const deleteCert = async (certId: string, fileUrl: string) => {
    const urlParts = fileUrl.split("/certifications/");
    if (urlParts[1]) await supabase.storage.from("certifications").remove([decodeURIComponent(urlParts[1])]);
    await supabase.from("certifications").delete().eq("id", certId);
    setCerts(prev => prev.filter(c => c.id !== certId));
    toast({ title: "Document removed" });
  };

  const isDocUploaded = (docLabel: string) => certs.some(c => c.name.toLowerCase() === docLabel.toLowerCase());

  const renderDocRow = (doc: { key: string; label: string; description: string }, required: boolean) => {
    const uploaded = isDocUploaded(doc.label);
    const existingCert = certs.find(c => c.name.toLowerCase() === doc.label.toLowerCase());
    return (
      <div key={doc.key} className={`p-4 rounded-lg border ${uploaded ? "border-green-500/30 bg-green-500/5" : required ? "border-chart-4/30 bg-chart-4/5" : "border-border"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {uploaded ? <CheckCircle className="w-5 h-5 text-green-500" /> : required ? <AlertTriangle className="w-5 h-5 text-chart-4" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium text-foreground">{doc.label} {required && <span className="text-destructive">*</span>}</p>
              <p className="text-xs text-muted-foreground">{doc.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {uploaded && existingCert?.file_url && (
              <>
                <a href={existingCert.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => deleteCert(existingCert.id, existingCert.file_url || "")}><Trash2 className="w-4 h-4" /></Button>
              </>
            )}
            {!uploaded && (
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => uploadDoc(doc.key, doc.label, e)} />
                <Button asChild variant="outline" size="sm" disabled={uploading === doc.key}>
                  <span><Upload className="w-3.5 h-3.5 mr-1.5" /> {uploading === doc.key ? "Uploading..." : "Upload"}</span>
                </Button>
              </label>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    pending: { icon: Clock, color: "text-chart-4", bg: "bg-chart-4/10", label: "Pending Review" },
    approved: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Approved" },
    rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Rejected" },
  };
  const st = statusConfig[profile?.verification_status] || statusConfig.pending;
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "F";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fundi Profile</h1>
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
            <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">{initials}</div>
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

      <Tabs defaultValue="demographics" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="demographics">Personal Details</TabsTrigger>
          <TabsTrigger value="skills">Skills & Services</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
        </TabsList>

        <TabsContent value="demographics" className="space-y-4">
          <div className="stat-card animate-fade-in space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={user?.name || ""} disabled className="bg-muted/50" /><p className="text-xs text-muted-foreground">Update in Settings</p></div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="bg-muted/50" /></div>
              <div className="space-y-2"><Label>National ID Number</Label><Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="e.g. 12345678" className="bg-muted/50" /></div>
            </div>
            <div className="space-y-2">
              <Label>Bio / About You</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell customers about your experience..." className="bg-muted/50 min-h-[100px]" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          <div className="stat-card animate-fade-in space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Skills & Services</h3>
            <p className="text-sm text-muted-foreground">Select the services you offer</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => toggleSkill(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 active:scale-[0.97] ${selectedSkills.includes(cat.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  {cat.icon} {cat.name}
                </button>
              ))}
              {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories available yet.</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Hourly Rate (KSH)</Label><Input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="500" className="bg-muted/50" /></div>
              <div className="space-y-2"><Label>Years of Experience</Label><Input type="number" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} placeholder="5" className="bg-muted/50" /></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="location" className="space-y-4">
          <div className="stat-card animate-fade-in space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Location Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Country</Label><Input value={country} onChange={e => setCountry(e.target.value)} className="bg-muted/50" /></div>
              <div className="space-y-2">
                <Label>County</Label>
                <Select value={county} onValueChange={setCounty}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select county" /></SelectTrigger>
                  <SelectContent>{KENYA_COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Constituency</Label><Input value={constituency} onChange={e => setConstituency(e.target.value)} placeholder="e.g. Westlands" className="bg-muted/50" /></div>
              <div className="space-y-2"><Label>Ward / Location</Label><Input value={ward} onChange={e => setWard(e.target.value)} placeholder="e.g. Kangemi" className="bg-muted/50" /></div>
            </div>
            <div className="space-y-2">
              <Label>Service Area</Label>
              <Input value={serviceArea} onChange={e => setServiceArea(e.target.value)} placeholder="e.g. Nairobi CBD, Westlands" className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">Areas where you're available to work</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <div className="stat-card animate-fade-in space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">Required Documents</h3>
              {!hasRequiredDocs() && <AlertTriangle className="w-4 h-4 text-chart-4" />}
            </div>
            <p className="text-sm text-muted-foreground">You must upload these for verification</p>
            <div className="space-y-3">{REQUIRED_DOCS.map(doc => renderDocRow(doc, true))}</div>
          </div>
          <div className="stat-card animate-fade-in space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Licenses & Clearances</h3>
            <div className="space-y-3">{LICENSE_DOCS.map(doc => renderDocRow(doc, false))}</div>
          </div>
          <div className="stat-card animate-fade-in space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Other Certifications</h3>
            <div className="flex gap-2">
              <Input value={certName} onChange={e => setCertName(e.target.value)} placeholder="Certificate name (e.g. Electrical License)" className="bg-muted/50 flex-1" />
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={uploadCertification} />
                <Button asChild variant="outline" disabled={uploading === "custom" || !certName.trim()}><span><Upload className="w-4 h-4 mr-2" /> {uploading === "custom" ? "Uploading..." : "Upload"}</span></Button>
              </label>
            </div>
            {certs.filter(c => ![...REQUIRED_DOCS, ...LICENSE_DOCS, ...ACADEMIC_DOCS].some(d => d.label.toLowerCase() === c.name.toLowerCase())).map(cert => (
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
        </TabsContent>

        <TabsContent value="academic" className="space-y-4">
          <div className="stat-card animate-fade-in space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Academic Documents</h3>
            <p className="text-sm text-muted-foreground">Upload academic certificates, diplomas, or trade certificates</p>
            <div className="space-y-3">{ACADEMIC_DOCS.map(doc => renderDocRow(doc, false))}</div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Consent / Agreement */}
      <div className="stat-card animate-fade-in space-y-4 border-primary/20">
        <h3 className="text-lg font-semibold text-foreground">Platform Agreement</h3>
        <div className="space-y-2">
          {PLATFORM_RULES.map((rule, i) => (
            <p key={i} className="text-sm text-muted-foreground">• {rule}</p>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Checkbox id="consent" checked={consentChecked} onCheckedChange={(v) => setConsentChecked(!!v)} />
          <label htmlFor="consent" className="text-sm font-medium text-foreground cursor-pointer">
            I have read and agree to the platform terms and conditions
          </label>
        </div>
      </div>

      <Button onClick={saveProfile} disabled={saving || !consentChecked} className="active:scale-[0.97] w-full sm:w-auto">
        {saving ? "Saving..." : "Save & Submit for Review"}
      </Button>
    </div>
  );
}
