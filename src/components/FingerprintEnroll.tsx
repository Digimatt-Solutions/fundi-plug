import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck, Trash2, Loader2, Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isWebAuthnSupported, registerFingerprint, verifyFingerprint } from "@/lib/webauthn";

type Cred = {
  id: string;
  credential_id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

/**
 * Profile-section block that lets a user enroll a fingerprint passkey on this device,
 * test it, and (for fundis) preview the public info clients see when they verify.
 */
export default function FingerprintEnroll({
  showFundiPreview = false,
}: { showFundiPreview?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [creds, setCreds] = useState<Cred[]>([]);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => { setSupported(isWebAuthnSupported()); }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("webauthn_credentials")
      .select("id, credential_id, device_label, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setCreds((data as Cred[]) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const enroll = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { credentialId, publicKey, deviceLabel } = await registerFingerprint({
        userId: user.id, email: user.email, displayName: user.name || user.email,
      });
      const { error } = await supabase.from("webauthn_credentials").insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        device_label: deviceLabel,
        email: user.email,
      });
      if (error) throw error;
      toast({ title: "Fingerprint registered", description: `Enrolled on ${deviceLabel}.` });
      load();
    } catch (e: any) {
      toast({ title: "Could not enroll fingerprint", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("webauthn_credentials").delete().eq("id", id);
    toast({ title: "Fingerprint removed" });
    load();
  };

  const test = async () => {
    if (creds.length === 0) {
      toast({ title: "No fingerprint registered yet", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const credId = await verifyFingerprint(creds.map((c) => c.credential_id));
      const match = creds.find((c) => c.credential_id === credId);
      if (!match) throw new Error("Fingerprint did not match any registered credential.");
      await supabase.from("webauthn_credentials")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", match.id);

      if (showFundiPreview && user) {
        // Load fundi public info that a client would see
        const [{ data: profile }, { data: wp }, { data: reviews }] = await Promise.all([
          supabase.from("profiles").select("name, avatar_url, phone, is_online").eq("id", user.id).maybeSingle(),
          supabase.from("worker_profiles").select("bio, hourly_rate, years_experience, service_area, county, skills, verification_status").eq("user_id", user.id).maybeSingle(),
          supabase.from("reviews").select("rating, comment").eq("reviewee_id", user.id),
        ]);
        const ratings = (reviews || []).map((r) => r.rating);
        const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
        let skillNames: string[] = [];
        if (wp?.skills?.length) {
          const { data: cats } = await supabase.from("service_categories").select("name").in("id", wp.skills);
          skillNames = (cats || []).map((c) => c.name);
        }
        setPreview({
          name: profile?.name,
          avatar_url: profile?.avatar_url,
          phone: profile?.phone,
          is_online: profile?.is_online,
          bio: wp?.bio,
          hourly_rate: wp?.hourly_rate,
          years_experience: wp?.years_experience,
          service_area: wp?.service_area || wp?.county,
          verification_status: wp?.verification_status,
          skills: skillNames,
          rating: avg,
          reviews: reviews?.length || 0,
        });
      } else {
        toast({ title: "Fingerprint verified" });
      }
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (!supported) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-primary" /> Fingerprint Sign-in
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This device or browser does not support fingerprint registration. Open the app on your phone (Chrome/Safari)
            to enroll your fingerprint.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-primary" /> Fingerprint Sign-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Register your fingerprint on this device for fast, secure sign-in. You can enroll on multiple devices.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={enroll} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {busy ? "Registering..." : "Register fingerprint"}
          </Button>
          <Button variant="outline" onClick={test} disabled={testing || creds.length === 0} className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {testing ? "Verifying..." : showFundiPreview ? "Test & preview client view" : "Test fingerprint"}
          </Button>
        </div>

        {creds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Registered devices</p>
            {creds.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.device_label || "Device"}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(c.created_at).toLocaleDateString()}
                    {c.last_used_at && ` - last used ${new Date(c.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(c.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No fingerprints registered on this device yet.</p>
        )}
      </CardContent>

      {/* Fundi public info preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" /> Verified - this is what clients see
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {preview.avatar_url ? (
                  <img src={preview.avatar_url} alt={preview.name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {(preview.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{preview.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {preview.is_online ? "Online now" : "Offline"} - {preview.verification_status || "pending"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current text-chart-4" />
                    {preview.rating > 0 ? preview.rating : "New"}
                    <span className="text-xs text-muted-foreground">({preview.reviews})</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Hourly rate</p>
                  <p className="font-semibold">{preview.hourly_rate ? `KSH ${preview.hourly_rate}` : "Not set"}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <p className="font-semibold">{preview.years_experience || 0} yrs</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-semibold flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5" />{preview.service_area || "-"}
                  </p>
                </div>
              </div>
              {preview.skills?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.skills.map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {preview.bio && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">About</p>
                  <p className="text-sm text-foreground">{preview.bio}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
