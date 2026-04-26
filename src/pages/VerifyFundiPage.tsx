import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Star, MapPin, Phone, Mail, BadgeCheck } from "lucide-react";
import logo from "@/assets/logo.png";
import cover from "@/assets/fundiplug-cover.jpg";

/**
 * Public-ish landing reached by scanning a fundi's QR.
 * Shows the fundi's photo + key details for on-site identity confirmation.
 */
export default function VerifyFundiPage() {
  const { workerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [wp, setWp] = useState<any>(null);
  const [avg, setAvg] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!workerId) return;
    async function load() {
      const [{ data: prof }, { data: w }, { data: revs }] = await Promise.all([
        supabase.from("profiles").select("id, name, avatar_url, phone, email, is_online").eq("id", workerId!).maybeSingle(),
        supabase.from("worker_profiles").select("first_name, last_name, profile_photo_url, selfie_with_id_url, county, service_area, hourly_rate, years_experience, verification_status, skills, bio").eq("user_id", workerId!).maybeSingle(),
        supabase.from("reviews").select("rating").eq("reviewee_id", workerId!),
      ]);
      setProfile(prof);
      setWp(w);
      const ratings = (revs || []).map((r) => r.rating);
      setReviewCount(ratings.length);
      setAvg(ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0);
      setLoading(false);
    }
    load();
  }, [workerId]);

  useEffect(() => {
    if (profile) document.title = `Verify ${profile.name} | FundiPlug`;
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 max-w-md mx-auto space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold text-foreground">Fundi not found</h1>
        <p className="text-sm text-muted-foreground mt-1">This QR code is invalid or has expired.</p>
        <Link to="/" className="text-primary hover:underline mt-4 text-sm">Back to FundiPlug</Link>
      </div>
    );
  }

  const photo = wp?.profile_photo_url || profile.avatar_url;
  const fullName = (wp?.first_name && wp?.last_name) ? `${wp.first_name} ${wp.last_name}` : profile.name;
  const verified = wp?.verification_status === "approved";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-md mx-auto flex items-center gap-3 p-4">
          <img src={logo} alt="FundiPlug" className="w-8 h-8 rounded" />
          <span className="font-bold text-primary">FundiPlug Identity Check</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        {/* Identity */}
        <section className="stat-card text-center space-y-3">
          {photo ? (
            <img src={photo} alt={fullName} className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-primary/20" />
          ) : (
            <div className="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-3xl mx-auto border-4 border-primary/20">
              {(fullName || "F").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
              {fullName}
              {verified && <BadgeCheck className="w-5 h-5 text-primary" />}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${profile.is_online ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                {profile.is_online ? "Online now" : "Offline"}
              </span>
              {verified && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Verified Fundi
                </span>
              )}
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className={`w-4 h-4 ${s <= Math.round(avg) ? "text-chart-4 fill-current" : "text-muted-foreground"}`} />
              ))}
              <span className="text-sm font-semibold ml-1">{avg > 0 ? avg : "-"}</span>
              <span className="text-xs text-muted-foreground">({reviewCount})</span>
            </div>
          </div>

          {wp?.selfie_with_id_url && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">ID-verified selfie on file</p>
              <p className="text-[11px] text-muted-foreground">Compare the face above with the person in front of you.</p>
            </div>
          )}
        </section>

        {/* Quick details */}
        <section className="stat-card space-y-2.5 text-sm">
          {wp?.service_area || wp?.county ? (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{wp.service_area || wp.county}</span>
            </div>
          ) : null}
          {profile.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${profile.phone}`} className="text-foreground hover:text-primary">{profile.phone}</a>
            </div>
          )}
          {profile.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground truncate">{profile.email}</span>
            </div>
          )}
          {wp?.years_experience !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Experience</span>
              <span className="text-foreground font-medium">{wp.years_experience} yrs</span>
            </div>
          )}
          {wp?.hourly_rate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hourly rate</span>
              <span className="text-foreground font-medium">KSH {wp.hourly_rate}</span>
            </div>
          )}
          {wp?.bio && <p className="text-xs text-muted-foreground pt-2 border-t border-border">{wp.bio}</p>}
        </section>

        {/* Marketing banner */}
        <a href="/" className="block">
          <img src={cover} alt="Connect with skilled fundis you can rely on" className="w-full rounded-xl border border-border" />
        </a>

        <footer className="text-center py-4 text-xs text-muted-foreground">
          FundiPlug - © Digimatt Solutions 2026
        </footer>
      </main>
    </div>
  );
}
