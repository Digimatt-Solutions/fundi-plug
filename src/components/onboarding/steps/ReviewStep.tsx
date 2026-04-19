import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, MapPin, FileText, GraduationCap, CreditCard, History, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  data: any;
  userId: string;
}

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="p-2.5 rounded-lg bg-muted/40">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm text-foreground break-words">{value || value === 0 ? String(value) : <span className="text-muted-foreground italic">Not provided</span>}</p>
  </div>
);

const Section = ({ icon, title, children }: any) => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      {children}
    </CardContent>
  </Card>
);

const Img = ({ url, label }: { url?: string; label: string }) =>
  url ? (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={label} className="w-full h-32 object-cover rounded-lg border hover:opacity-90 transition" />
      </a>
    </div>
  ) : (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground">
        Missing
      </div>
    </div>
  );

export default function ReviewStep({ data, userId }: Props) {
  const [education, setEducation] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [edu, wh] = await Promise.all([
        supabase.from("worker_education").select("*").eq("worker_id", userId).order("created_at", { ascending: false }),
        supabase.from("worker_work_history").select("*").eq("worker_id", userId).order("created_at", { ascending: false }),
      ]);
      setEducation(edu.data || []);
      setHistory(wh.data || []);
    })();
  }, [userId]);

  const fullName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Review your information carefully</p>
            <p className="text-xs text-muted-foreground">Go back to any step to make corrections. Once submitted, an admin will review your profile.</p>
          </div>
        </CardContent>
      </Card>

      <Section icon={<User className="w-4 h-4" />} title="Personal Information">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Full Name" value={fullName} />
          <Field label="ID Number" value={data.id_number} />
          <Field label="Date of Birth" value={data.date_of_birth} />
          <Field label="Gender" value={data.gender} />
          <Field label="Alt Phone" value={data.alt_phone} />
          <Field label="Next of Kin" value={data.next_of_kin_name ? `${data.next_of_kin_name} (${data.next_of_kin_relationship || "-"})` : null} />
          <Field label="NoK Phone" value={data.next_of_kin_phone} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Img url={data.profile_photo_url} label="Profile Photo" />
          <Img url={data.selfie_with_id_url} label="Selfie with ID" />
        </div>
        <Field label="Bio" value={data.bio} />
      </Section>

      <Section icon={<Briefcase className="w-4 h-4" />} title="Skills & Experience">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Experience Level" value={data.experience_level} />
          <Field label="Years Experience" value={data.years_experience} />
          <Field label="Daily Rate" value={data.daily_rate ? `KSH ${data.daily_rate}` : null} />
          <Field label="Hourly Rate" value={data.hourly_rate ? `KSH ${data.hourly_rate}` : null} />
          <Field label="Availability" value={data.availability_type} />
          <Field label="Working Days" value={(data.availability_days || []).map((d: number) => dayNames[d]).join(", ")} />
        </div>
        {data.skills?.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Skills</p>
            <div className="flex flex-wrap gap-1">{data.skills.map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>
          </div>
        )}
        {data.tools_owned?.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tools Owned</p>
            <div className="flex flex-wrap gap-1">{data.tools_owned.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
          </div>
        )}
        {data.portfolio_urls?.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Portfolio ({data.portfolio_urls.length})</p>
            <div className="grid grid-cols-3 gap-2">
              {data.portfolio_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="w-full h-20 object-cover rounded border hover:opacity-90 transition" />
                </a>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section icon={<MapPin className="w-4 h-4" />} title="Location">
        <div className="grid grid-cols-2 gap-2">
          <Field label="County" value={data.county} />
          <Field label="Constituency" value={data.constituency} />
          <Field label="Ward" value={data.ward} />
          <Field label="Service Area" value={data.service_area} />
          <Field label="Service Radius" value={data.service_radius_km ? `${data.service_radius_km} km` : null} />
          <Field label="Willing to Travel" value={data.willing_to_travel ? `Yes, up to ${data.max_travel_km || 0} km` : "No"} />
        </div>
        <Field label="Exact Address" value={data.exact_address} />
        {data.latitude && data.longitude && <Field label="GPS Coordinates" value={`${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`} />}
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="Documents">
        <div className="grid grid-cols-2 gap-2">
          <Img url={data.id_front_url} label="ID Front" />
          <Img url={data.id_back_url} label="ID Back" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="NCA Number" value={data.nca_number} />
          <Field label="KRA PIN" value={data.kra_pin} />
        </div>
      </Section>

      <Section icon={<GraduationCap className="w-4 h-4" />} title={`Academic (${education.length})`}>
        {education.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No academic records added</p>
        ) : (
          education.map((e) => (
            <div key={e.id} className="p-2.5 rounded-lg bg-muted/40 text-sm">
              <p className="font-medium text-foreground">{e.level} — {e.institution}</p>
              <p className="text-xs text-muted-foreground">{e.course || "-"} • {e.status || "-"} • {e.start_date || "?"} → {e.end_date || "Present"}</p>
              {e.file_url && <a href={e.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View certificate</a>}
            </div>
          ))
        )}
      </Section>

      <Section icon={<CreditCard className="w-4 h-4" />} title="Payment">
        <div className="grid grid-cols-2 gap-2">
          <Field label="M-Pesa Number" value={data.mpesa_number} />
          <Field label="M-Pesa Name" value={data.mpesa_name} />
          <Field label="Bank Name" value={data.bank_name} />
          <Field label="Bank Account" value={data.bank_account} />
        </div>
      </Section>

      <Section icon={<History className="w-4 h-4" />} title={`Work History (${history.length})`}>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No work history added</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="p-2.5 rounded-lg bg-muted/40 text-sm">
              <p className="font-medium text-foreground">{h.role}{h.company ? ` @ ${h.company}` : ""}</p>
              <p className="text-xs text-muted-foreground">{h.start_date || "?"} → {h.end_date || "Present"}</p>
              {h.description && <p className="text-xs text-foreground/80 mt-1">{h.description}</p>}
              {h.reference_name && <p className="text-xs text-muted-foreground mt-1">Ref: {h.reference_name} {h.reference_phone && `(${h.reference_phone})`}</p>}
            </div>
          ))
        )}
      </Section>

      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-3 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">Looks good? Click <strong>Next</strong> to accept the agreements and submit.</p>
        </CardContent>
      </Card>
    </div>
  );
}
