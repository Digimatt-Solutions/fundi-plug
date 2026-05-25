import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ShieldCheck, Clock, XCircle, FileEdit } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import { AssetImage } from "@/components/AssetImage";

const CATEGORIES = [
  "Building Materials", "Hardware & Tools", "Electrical Supplies", "Plumbing Supplies",
  "Paint & Finishes", "Tiles & Flooring", "Doors & Windows", "Furniture",
  "Safety Equipment", "Machinery & Equipment", "Other",
];

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-foreground", icon: FileEdit },
  pending: { label: "Pending Verification", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/15 text-green-700 dark:text-green-400", icon: ShieldCheck },
  rejected: { label: "Rejected", color: "bg-destructive/15 text-destructive", icon: XCircle },
};

export default function SupplierBusinessProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    business_name: "", description: "", logo_url: "", banner_url: "",
    category: "", category_other: "", physical_address: "", county: "", town: "",
    latitude: null, longitude: null, business_email: "", business_phone: "",
    website: "", kra_pin: "", registration_number: "", years_in_operation: "",
    verification_status: "draft", rejection_reason: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setForm({ ...form, ...data, years_in_operation: data.years_in_operation ?? "" });
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [user]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const uploadFile = async (file: File, kind: "logo" | "banner") => {
    if (!user) return;
    const path = `${user.id}/${kind}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("business-assets").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
    const { data } = supabase.storage.from("business-assets").getPublicUrl(path);
    set(kind === "logo" ? "logo_url" : "banner_url", data.publicUrl);
  };

  const save = async (submit = false) => {
    if (!user) return;
    if (!form.business_name?.trim()) { toast({ title: "Business name is required", variant: "destructive" }); return; }
    submit ? setSubmitting(true) : setSaving(true);
    const payload: any = {
      user_id: user.id,
      business_name: form.business_name,
      description: form.description || null,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      category: form.category || null,
      category_other: form.category === "Other" ? form.category_other : null,
      physical_address: form.physical_address || null,
      county: form.county || null,
      town: form.town || null,
      latitude: form.latitude, longitude: form.longitude,
      business_email: form.business_email || null,
      business_phone: form.business_phone || null,
      website: form.website || null,
      kra_pin: form.kra_pin || null,
      registration_number: form.registration_number || null,
      years_in_operation: form.years_in_operation ? Number(form.years_in_operation) : null,
    };
    if (submit) {
      payload.verification_status = "pending";
      payload.submitted_at = new Date().toISOString();
      payload.rejection_reason = null;
    }
    const { error } = await supabase.from("business_profiles").upsert(payload, { onConflict: "user_id" });
    submit ? setSubmitting(false) : setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: submit ? "Submitted for verification" : "Saved", description: submit ? "Admins will review your business shortly." : "Your changes are saved." });
    if (submit) set("verification_status", "pending");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const status = form.verification_status || "draft";
  const meta = statusMeta[status];
  const StatusIcon = meta.icon;
  const locked = status === "pending" || status === "approved";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Profile</h1>
          <p className="text-sm text-muted-foreground">Tell customers about your business. Required for product listings.</p>
        </div>
        <Badge className={`${meta.color} text-sm py-1.5 px-3 gap-1.5`} variant="outline">
          <StatusIcon className="w-4 h-4" /> {meta.label}
        </Badge>
      </div>

      {status === "rejected" && form.rejection_reason && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Reason for rejection:</strong> {form.rejection_reason}
        </div>
      )}

      {form.banner_url && (
        <AssetImage src={form.banner_url} bucket="business-assets" alt="Banner" className="w-full h-40 object-cover rounded-xl border border-border" />
      )}

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {form.logo_url ? (
            <AssetImage src={form.logo_url} bucket="business-assets" alt="Logo" className="w-20 h-20 rounded-xl object-cover border border-border" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">No logo</div>
          )}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 cursor-pointer">
              <Button asChild variant="outline" size="sm" disabled={locked}>
                <span><Upload className="w-4 h-4 mr-1" /> Upload Logo</span>
              </Button>
              <input type="file" accept="image/*" className="hidden" disabled={locked}
                onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], "logo")} />
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <Button asChild variant="outline" size="sm" disabled={locked}>
                <span><Upload className="w-4 h-4 mr-1" /> Upload Banner (optional)</span>
              </Button>
              <input type="file" accept="image/*" className="hidden" disabled={locked}
                onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], "banner")} />
            </Label>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Business Name *</Label>
            <Input value={form.business_name} disabled={locked} onChange={e => set("business_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Business Category</Label>
            <Select value={form.category || ""} disabled={locked} onValueChange={v => set("category", v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.category === "Other" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Specify Category</Label>
              <Input value={form.category_other || ""} disabled={locked} onChange={e => set("category_other", e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Business Description</Label>
            <Textarea rows={3} value={form.description || ""} disabled={locked} onChange={e => set("description", e.target.value)} placeholder="What does your business do?" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Physical Address</Label>
            <Input value={form.physical_address || ""} disabled={locked} onChange={e => set("physical_address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>County</Label>
            <Input value={form.county || ""} disabled={locked} onChange={e => set("county", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Town</Label>
            <Input value={form.town || ""} disabled={locked} onChange={e => set("town", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Pin Business Location on Map</Label>
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              disabled={locked}
              onChange={({ latitude, longitude, town, county, address }) => {
                setForm((f: any) => ({
                  ...f,
                  latitude,
                  longitude,
                  town: f.town || town || "",
                  county: f.county || county || "",
                  physical_address: f.physical_address || address || "",
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">Search above or use your current location - we'll capture coordinates and auto-fill town/county.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Business Email</Label>
            <Input type="email" value={form.business_email || ""} disabled={locked} onChange={e => set("business_email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Business WhatsApp Number</Label>
            <Input value={form.business_phone || ""} disabled={locked} onChange={e => set("business_phone", e.target.value)} placeholder="2547XXXXXXXX" />
            <p className="text-[11px] text-muted-foreground">Used for marketplace WhatsApp orders. Use international format starting with 254.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Website</Label>
            <Input value={form.website || ""} disabled={locked} onChange={e => set("website", e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label>KRA PIN</Label>
            <Input value={form.kra_pin || ""} disabled={locked} onChange={e => set("kra_pin", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Business Registration Number</Label>
            <Input value={form.registration_number || ""} disabled={locked} onChange={e => set("registration_number", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Years in Operation</Label>
            <Input type="number" min={0} value={form.years_in_operation || ""} disabled={locked} onChange={e => set("years_in_operation", e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          <Button onClick={() => save(false)} variant="outline" disabled={saving || locked}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Draft
          </Button>
          {(status === "draft" || status === "rejected") && (
            <Button onClick={() => save(true)} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Submit for Verification
            </Button>
          )}
          {status === "pending" && (
            <p className="text-sm text-muted-foreground self-center">Your profile is under review. You'll be notified once verified.</p>
          )}
          {status === "approved" && (
            <p className="text-sm text-green-600 self-center flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Verified business - you can now manage products.</p>
          )}
        </div>
      </div>
    </div>
  );
}
