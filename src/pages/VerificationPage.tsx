import { useEffect, useState } from "react";
import { Check, X, FileText, Clock, Eye, ShieldCheck, ShieldX, ShieldAlert, User, MapPin, GraduationCap, Briefcase, CreditCard, History as HistoryIcon, FileSignature, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="p-2.5 rounded-lg bg-muted/40">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm text-foreground break-words">{value || value === 0 ? String(value) : <span className="text-muted-foreground italic">Not provided</span>}</p>
  </div>
);

const ImgPreview = ({ url, label }: { url?: string; label: string }) => (
  <div className="space-y-1">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    {url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={label} className="w-full h-36 object-cover rounded-lg border hover:opacity-90 transition" />
      </a>
    ) : (
      <div className="w-full h-36 rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 flex items-center justify-center text-xs text-destructive">
        Missing
      </div>
    )}
  </div>
);

const SectionHeader = ({ icon, title }: any) => (
  <div className="flex items-center gap-2 pb-2 mb-3 border-b">
    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
  </div>
);

export default function VerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewWorker, setViewWorker] = useState<any>(null);
  const [education, setEducation] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from("worker_profiles")
      .select("*, profiles:user_id(name, email, avatar_url, phone)")
      .order("created_at", { ascending: false });
    setWorkers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const channel = supabase.channel("verification-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const openWorker = async (worker: any) => {
    setViewWorker(worker);
    const [edu, wh] = await Promise.all([
      supabase.from("worker_education").select("*").eq("worker_id", worker.user_id).order("created_at", { ascending: false }),
      supabase.from("worker_work_history").select("*").eq("worker_id", worker.user_id).order("created_at", { ascending: false }),
    ]);
    setEducation(edu.data || []);
    setHistory(wh.data || []);
  };

  const handleApprove = async () => {
    if (!viewWorker) return;
    setActionLoading(true);
    await supabase.from("worker_profiles").update({
      verification_status: "approved",
      rejection_reason: null,
      onboarding_completed_at: new Date().toISOString(),
    }).eq("id", viewWorker.id);
    await supabase.from("activity_logs").insert({
      user_id: user!.id,
      action: "Fundi Approved",
      detail: `Verified ${viewWorker.profiles?.name || "fundi"}`,
      entity_type: "worker_profile",
      entity_id: viewWorker.id,
    });
    toast({ title: "Fundi approved", description: "They will now appear in customer searches." });
    setViewWorker(null);
    setActionLoading(false);
    loadAll();
  };

  const submitRejection = async () => {
    if (!viewWorker) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      toast({ title: "Reason required", description: "Provide at least 10 characters explaining why.", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    await supabase.from("worker_profiles").update({
      verification_status: "rejected",
      rejection_reason: rejectReason.trim(),
      submitted_for_review: false,
    }).eq("id", viewWorker.id);
    await supabase.from("activity_logs").insert({
      user_id: user!.id,
      action: "Fundi Rejected",
      detail: rejectReason.trim().slice(0, 200),
      entity_type: "worker_profile",
      entity_id: viewWorker.id,
    });
    toast({ title: "Fundi rejected", description: "They can edit and resubmit." });
    setRejectDialog(false);
    setRejectReason("");
    setViewWorker(null);
    setActionLoading(false);
    loadAll();
  };

  const pending = workers.filter(w => w.verification_status === "pending" && w.submitted_for_review);
  const approved = workers.filter(w => w.verification_status === "approved");
  const rejected = workers.filter(w => w.verification_status === "rejected");
  const drafts = workers.filter(w => w.verification_status === "pending" && !w.submitted_for_review);

  const statusBadge = (w: any) => {
    if (w.verification_status === "approved") return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">Approved</Badge>;
    if (w.verification_status === "rejected") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">Rejected</Badge>;
    if (w.submitted_for_review) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">Pending Review</Badge>;
    return <Badge variant="outline">Draft</Badge>;
  };

  const renderWorkerCard = (w: any, i: number) => (
    <div key={w.id} className="rounded-xl border bg-card p-4 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm overflow-hidden">
            {w.profile_photo_url || w.profiles?.avatar_url
              ? <img src={w.profile_photo_url || w.profiles.avatar_url} className="w-full h-full object-cover rounded-full" />
              : (w.profiles?.name || "F").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground text-sm">{w.profiles?.name || "Unknown"}</p>
              {statusBadge(w)}
            </div>
            <p className="text-xs text-muted-foreground">{w.profiles?.email}</p>
            {w.skills?.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{w.skills.slice(0, 3).join(" • ")}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(w.created_at).toLocaleDateString()}</span>
          <Button size="sm" className="h-8 text-xs" onClick={() => openWorker(w)}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Review
          </Button>
        </div>
      </div>
      {w.verification_status === "rejected" && w.rejection_reason && (
        <p className="text-xs text-destructive mt-2 pl-14">Reason: {w.rejection_reason}</p>
      )}
    </div>
  );

  const emptyState = (icon: React.ReactNode, title: string, sub: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <p className="text-foreground font-medium mt-2">{title}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></div>;
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullName = viewWorker ? [viewWorker.first_name, viewWorker.middle_name, viewWorker.last_name].filter(Boolean).join(" ") : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fundi Verification</h1>
        <p className="text-muted-foreground text-sm">Review submitted profiles and approve or reject them</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-2xl font-bold text-foreground">{pending.length}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-green-500" /></div>
          <div><p className="text-2xl font-bold text-foreground">{approved.length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><ShieldX className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-2xl font-bold text-foreground">{rejected.length}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><FileText className="w-5 h-5 text-muted-foreground" /></div>
          <div><p className="text-2xl font-bold text-foreground">{drafts.length}</p><p className="text-xs text-muted-foreground">Drafts</p></div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="pending" className="gap-1.5"><ShieldAlert className="w-4 h-4" /> Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5"><ShieldCheck className="w-4 h-4" /> Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5"><ShieldX className="w-4 h-4" /> Rejected ({rejected.length})</TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5"><FileText className="w-4 h-4" /> Drafts ({drafts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length > 0 ? pending.map(renderWorkerCard) : emptyState(<Check className="w-10 h-10 text-green-500" />, "All caught up!", "No pending verifications")}
        </TabsContent>
        <TabsContent value="approved" className="space-y-3 mt-4">
          {approved.length > 0 ? approved.map(renderWorkerCard) : emptyState(<ShieldCheck className="w-10 h-10 text-muted-foreground" />, "No approved fundis yet", "Approve pending fundis to see them here")}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-3 mt-4">
          {rejected.length > 0 ? rejected.map(renderWorkerCard) : emptyState(<ShieldX className="w-10 h-10 text-muted-foreground" />, "No rejected fundis", "Rejected fundis will appear here")}
        </TabsContent>
        <TabsContent value="drafts" className="space-y-3 mt-4">
          {drafts.length > 0 ? drafts.map(renderWorkerCard) : emptyState(<FileText className="w-10 h-10 text-muted-foreground" />, "No drafts", "Fundis still completing onboarding")}
        </TabsContent>
      </Tabs>

      {/* Detailed Sequential Review Dialog */}
      <Dialog open={!!viewWorker} onOpenChange={(o) => !o && setViewWorker(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{viewWorker?.profiles?.name}</span>
              {viewWorker && statusBadge(viewWorker)}
            </DialogTitle>
          </DialogHeader>

          {viewWorker && (
            <div className="space-y-4">
              {/* 1. Personal */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<User className="w-4 h-4" />} title="1. Personal Information" />
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Field label="Full Name" value={fullName} />
                  <Field label="ID Number" value={viewWorker.id_number} />
                  <Field label="Date of Birth" value={viewWorker.date_of_birth} />
                  <Field label="Gender" value={viewWorker.gender} />
                  <Field label="Email" value={viewWorker.profiles?.email} />
                  <Field label="Phone" value={viewWorker.profiles?.phone} />
                  <Field label="Alt Phone" value={viewWorker.alt_phone} />
                  <Field label="Next of Kin" value={viewWorker.next_of_kin_name} />
                  <Field label="NoK Relationship" value={viewWorker.next_of_kin_relationship} />
                  <Field label="NoK Phone" value={viewWorker.next_of_kin_phone} />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <ImgPreview url={viewWorker.profile_photo_url} label="Profile Photo" />
                  <ImgPreview url={viewWorker.selfie_with_id_url} label="Selfie with ID" />
                </div>
                <Field label="Bio" value={viewWorker.bio} />
              </CardContent></Card>

              {/* 2. Skills */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<Briefcase className="w-4 h-4" />} title="2. Skills & Experience" />
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Field label="Experience Level" value={viewWorker.experience_level} />
                  <Field label="Years Experience" value={viewWorker.years_experience} />
                  <Field label="Daily Rate" value={viewWorker.daily_rate ? `KSH ${viewWorker.daily_rate}` : null} />
                  <Field label="Hourly Rate" value={viewWorker.hourly_rate ? `KSH ${viewWorker.hourly_rate}` : null} />
                  <Field label="Availability Type" value={viewWorker.availability_type} />
                  <Field label="Working Days" value={(viewWorker.availability_days || []).map((d: number) => dayNames[d]).join(", ")} />
                </div>
                {viewWorker.skills?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1">{viewWorker.skills.map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>
                  </div>
                )}
                {viewWorker.tools_owned?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Tools Owned</p>
                    <div className="flex flex-wrap gap-1">{viewWorker.tools_owned.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                  </div>
                )}
                {viewWorker.portfolio_urls?.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Portfolio ({viewWorker.portfolio_urls.length})</p>
                    <div className="grid grid-cols-4 gap-2">
                      {viewWorker.portfolio_urls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" className="w-full h-20 object-cover rounded border hover:opacity-90 transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent></Card>

              {/* 3. Location */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<MapPin className="w-4 h-4" />} title="3. Location" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="County" value={viewWorker.county} />
                  <Field label="Constituency" value={viewWorker.constituency} />
                  <Field label="Ward" value={viewWorker.ward} />
                  <Field label="Service Area" value={viewWorker.service_area} />
                  <Field label="Service Radius" value={viewWorker.service_radius_km ? `${viewWorker.service_radius_km} km` : null} />
                  <Field label="Willing to Travel" value={viewWorker.willing_to_travel ? `Yes, up to ${viewWorker.max_travel_km || 0} km` : "No"} />
                  <div className="col-span-2"><Field label="Exact Address" value={viewWorker.exact_address} /></div>
                  {viewWorker.latitude && viewWorker.longitude && (
                    <div className="col-span-2"><Field label="GPS Coordinates" value={`${viewWorker.latitude}, ${viewWorker.longitude}`} /></div>
                  )}
                </div>
              </CardContent></Card>

              {/* 4. Documents */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<FileText className="w-4 h-4" />} title="4. Identity Documents" />
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <ImgPreview url={viewWorker.id_front_url} label="ID Front" />
                  <ImgPreview url={viewWorker.id_back_url} label="ID Back" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="NCA Number" value={viewWorker.nca_number} />
                  <Field label="KRA PIN" value={viewWorker.kra_pin} />
                </div>
              </CardContent></Card>

              {/* 5. Academic */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<GraduationCap className="w-4 h-4" />} title={`5. Academic (${education.length})`} />
                {education.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No academic records added</p>
                ) : (
                  <div className="space-y-2">
                    {education.map((e) => (
                      <div key={e.id} className="p-3 rounded-lg bg-muted/40 text-sm">
                        <p className="font-medium text-foreground">{e.level} — {e.institution}</p>
                        <p className="text-xs text-muted-foreground">{e.course || "-"} • {e.status || "-"} • {e.start_date || "?"} → {e.end_date || "Present"}</p>
                        {e.file_url && <a href={e.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View certificate</a>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent></Card>

              {/* 6. Payment */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<CreditCard className="w-4 h-4" />} title="6. Payment Details" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="M-Pesa Number" value={viewWorker.mpesa_number} />
                  <Field label="M-Pesa Name" value={viewWorker.mpesa_name} />
                  <Field label="Bank Name" value={viewWorker.bank_name} />
                  <Field label="Bank Account" value={viewWorker.bank_account} />
                </div>
              </CardContent></Card>

              {/* 7. Work History */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<HistoryIcon className="w-4 h-4" />} title={`7. Work History (${history.length})`} />
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No work history added</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="p-3 rounded-lg bg-muted/40 text-sm">
                        <p className="font-medium text-foreground">{h.role}{h.company ? ` @ ${h.company}` : ""}</p>
                        <p className="text-xs text-muted-foreground">{h.start_date || "?"} → {h.end_date || "Present"}</p>
                        {h.description && <p className="text-xs text-foreground/80 mt-1">{h.description}</p>}
                        {h.reference_name && <p className="text-xs text-muted-foreground mt-1">Ref: {h.reference_name} {h.reference_phone && `(${h.reference_phone})`}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent></Card>

              {/* 8. Agreements */}
              <Card><CardContent className="p-4">
                <SectionHeader icon={<FileSignature className="w-4 h-4" />} title="8. Agreements & Consents" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {viewWorker.consent_background_check ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}
                    <span className="text-foreground">Consent for background check</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {viewWorker.consent_data_usage ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}
                    <span className="text-foreground">Consent for data usage</span>
                  </div>
                  {viewWorker.consented_at && <p className="text-xs text-muted-foreground">Signed on {new Date(viewWorker.consented_at).toLocaleString()}</p>}
                </div>
              </CardContent></Card>

              {viewWorker.verification_status === "rejected" && viewWorker.rejection_reason && (
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardContent className="p-4 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Previous rejection</p>
                      <p className="text-xs text-muted-foreground">{viewWorker.rejection_reason}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-3 border-t flex-row gap-2">
            <Button variant="outline" onClick={() => setViewWorker(null)} className="flex-1">Close</Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setRejectDialog(true)}
              disabled={actionLoading || viewWorker?.verification_status === "rejected"}
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={actionLoading || viewWorker?.verification_status === "approved"}
            >
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Fundi Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Explain what's missing or incorrect. The fundi will see this on their onboarding page and can fix and resubmit.
            </p>
            <Textarea
              placeholder="e.g. Selfie with ID is blurry, please upload a clearer photo. Also, the NCA number doesn't match our records..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{rejectReason.length} characters (minimum 10)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitRejection} disabled={actionLoading}>Reject Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
