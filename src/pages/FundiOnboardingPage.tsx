import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import StepShell from "@/components/onboarding/StepShell";
import PersonalStep from "@/components/onboarding/steps/PersonalStep";
import SkillsStep from "@/components/onboarding/steps/SkillsStep";
import LocationStep from "@/components/onboarding/steps/LocationStep";
import DocumentsStep from "@/components/onboarding/steps/DocumentsStep";
import AcademicStep from "@/components/onboarding/steps/AcademicStep";
import PaymentStep from "@/components/onboarding/steps/PaymentStep";
import WorkHistoryStep from "@/components/onboarding/steps/WorkHistoryStep";
import AgreementsStep from "@/components/onboarding/steps/AgreementsStep";
import ReviewStep from "@/components/onboarding/steps/ReviewStep";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, ShieldX, User, Briefcase, MapPin, FileText, GraduationCap, CreditCard, History, FileSignature, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { key: "personal", label: "Personal", icon: <User className="w-3.5 h-3.5" /> },
  { key: "skills", label: "Skills & Experience", icon: <Briefcase className="w-3.5 h-3.5" /> },
  { key: "location", label: "Location", icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: "documents", label: "Documents", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "academic", label: "Academic", icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { key: "payment", label: "Payment", icon: <CreditCard className="w-3.5 h-3.5" /> },
  { key: "history", label: "Work History", icon: <History className="w-3.5 h-3.5" /> },
  { key: "review", label: "Review", icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  { key: "agreement", label: "Agreements", icon: <FileSignature className="w-3.5 h-3.5" /> },
];

function validatePersonal(d: any): string | null {
  if (!d.first_name || !d.last_name) return "First and last name are required";
  if (!d.id_number) return "National ID number is required";
  if (!d.date_of_birth) return "Date of birth is required";
  if (!d.profile_photo_url) return "Profile photo is required";
  if (!d.selfie_with_id_url) return "Selfie with ID is required";
  if (!d.next_of_kin_name || !d.next_of_kin_phone) return "Next of kin name and phone are required";
  if (!d.bio || d.bio.length < 30) return "Bio should be at least 30 characters";
  return null;
}
function validateSkills(d: any): string | null {
  if (!d.skills || d.skills.length === 0) return "Pick at least one service category";
  if (!d.years_experience && d.years_experience !== 0) return "Years of experience required";
  if (!d.experience_level) return "Experience level required";
  if (!d.daily_rate) return "Daily rate required";
  if (!d.availability_type) return "Pick full-time or part-time";
  if (!d.availability_days || d.availability_days.length === 0) return "Select at least one working day";
  return null;
}
function validateLocation(d: any): string | null {
  if (!d.county || !d.constituency || !d.ward) return "County, constituency and ward are required";
  if (!d.exact_address) return "Exact address is required";
  if (!d.service_area) return "Service area is required";
  return null;
}
function validateDocuments(d: any): string | null {
  if (!d.id_front_url) return "Upload the front side of your ID";
  if (!d.id_back_url) return "Upload the back side of your ID";
  return null;
}
function validatePayment(d: any): string | null {
  if (!d.mpesa_number || d.mpesa_number.length < 10) return "Enter a valid M-Pesa number";
  if (!d.mpesa_name) return "Enter the registered M-Pesa name";
  return null;
}
function validateAgreements(d: any): string | null {
  if (!d.consent_background_check) return "You must consent to the background check";
  if (!d.consent_data_usage) return "You must accept the data usage terms";
  return null;
}

export default function FundiOnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>({});
  const [currentStep, setCurrentStep] = useState(0);
  const dirtyRef = useRef(false);

  // Load existing profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: wp } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (wp) {
        setData(wp);
        setCurrentStep(Math.min(wp.onboarding_step || 0, STEPS.length - 1));
      }
      setLoading(false);
    })();
  }, [user]);

  const patch = useCallback((p: any) => {
    setData((prev: any) => ({ ...prev, ...p }));
    dirtyRef.current = true;
  }, []);

  const persist = useCallback(
    async (overrideStep?: number, extra?: any) => {
      if (!user) return;
      setSaving(true);
      try {
        const payload: any = {
          user_id: user.id,
          first_name: data.first_name,
          middle_name: data.middle_name,
          last_name: data.last_name,
          alt_phone: data.alt_phone,
          profile_photo_url: data.profile_photo_url,
          selfie_with_id_url: data.selfie_with_id_url,
          id_front_url: data.id_front_url,
          id_back_url: data.id_back_url,
          next_of_kin_name: data.next_of_kin_name,
          next_of_kin_relationship: data.next_of_kin_relationship,
          next_of_kin_phone: data.next_of_kin_phone,
          gender: data.gender,
          date_of_birth: data.date_of_birth || null,
          id_number: data.id_number,
          bio: data.bio,
          skills: data.skills,
          sub_skills: data.sub_skills,
          other_skill: data.other_skill,
          years_experience: data.years_experience,
          experience_level: data.experience_level,
          daily_rate: data.daily_rate,
          hourly_rate: data.hourly_rate,
          tools_owned: data.tools_owned,
          portfolio_urls: data.portfolio_urls,
          availability_days: data.availability_days,
          availability_type: data.availability_type,
          country: data.country,
          county: data.county,
          constituency: data.constituency,
          ward: data.ward,
          exact_address: data.exact_address,
          landmark: data.landmark,
          service_area: data.service_area,
          service_radius_km: data.service_radius_km,
          willing_to_travel: data.willing_to_travel,
          max_travel_km: data.max_travel_km,
          latitude: data.latitude,
          longitude: data.longitude,
          nca_number: data.nca_number,
          kra_pin: data.kra_pin,
          mpesa_number: data.mpesa_number,
          mpesa_name: data.mpesa_name,
          bank_name: data.bank_name,
          bank_account: data.bank_account,
          consent_background_check: data.consent_background_check,
          consent_data_usage: data.consent_data_usage,
          onboarding_step: overrideStep ?? currentStep,
          ...(extra || {}),
        };
        const fullName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ").trim();

        const { error } = await supabase.from("worker_profiles").upsert(payload, { onConflict: "user_id" });
        if (error) throw error;

        if (fullName) {
          await supabase.from("profiles").update({ name: fullName, phone: data.alt_phone || undefined, avatar_url: data.profile_photo_url || undefined }).eq("id", user.id);
        }
        dirtyRef.current = false;
      } catch (e: any) {
        toast({ title: "Save failed", description: e.message, variant: "destructive" });
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [user, data, currentStep, toast]
  );

  const validators: Array<(d: any) => string | null> = [
    validatePersonal,
    validateSkills,
    validateLocation,
    validateDocuments,
    () => null, // academic — multi-row, validated separately if needed
    validatePayment,
    () => null, // work history — optional
    () => null, // review — read-only summary
    validateAgreements,
  ];

  const submitForReview = async () => {
    // Re-run all hard validators
    for (let i = 0; i < validators.length; i++) {
      const err = validators[i](data);
      if (err) {
        toast({ title: `Fix step ${i + 1}: ${STEPS[i].label}`, description: err, variant: "destructive" });
        setCurrentStep(i);
        return;
      }
    }
    try {
      await persist(STEPS.length - 1, {
        submitted_for_review: true,
        consented_at: new Date().toISOString(),
        verification_status: data.verification_status === "approved" ? "approved" : "pending",
        rejection_reason: null,
      });
      await supabase.from("activity_logs").insert({
        user_id: user!.id,
        action: "Fundi Submitted For Verification",
        detail: "Worker profile submitted for admin review",
        entity_type: "worker_profile",
        entity_id: user!.id,
      });
      setData((prev: any) => ({ ...prev, submitted_for_review: true, rejection_reason: null }));
      toast({ title: "Submitted for verification", description: "We'll notify you once an admin reviews your profile." });
      navigate("/dashboard");
    } catch {}
  };

  const goNext = async () => {
    const v = validators[currentStep];
    if (v) {
      const err = v(data);
      if (err) {
        toast({ title: "Almost there", description: err, variant: "destructive" });
        return;
      }
    }
    if (currentStep === STEPS.length - 1) {
      await submitForReview();
      return;
    }
    const next = currentStep + 1;
    try {
      await persist(next);
      setCurrentStep(next);
    } catch {}
  };

  const goPrev = async () => {
    const prev = Math.max(0, currentStep - 1);
    if (dirtyRef.current) {
      try { await persist(prev); } catch {}
    }
    setCurrentStep(prev);
  };

  const saveAndExit = async () => {
    try {
      await persist();
      toast({ title: "Progress saved", description: "Continue from where you left off any time." });
      navigate("/dashboard");
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const isApproved = data.verification_status === "approved";
  const isRejected = data.verification_status === "rejected";
  const submitted = !!data.submitted_for_review;
  const isFinalStep = currentStep === STEPS.length - 1;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isApproved ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Your profile is verified</p>
              <p className="text-xs text-muted-foreground">You appear in customer searches. You can still update details below.</p>
            </div>
            <Badge className="bg-green-500/15 text-green-700 border-green-500/30">Approved</Badge>
          </CardContent>
        </Card>
      ) : isRejected ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldX className="w-6 h-6 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Verification rejected</p>
              <p className="text-xs text-muted-foreground">{data.rejection_reason || "Please review your details and resubmit."}</p>
            </div>
          </CardContent>
        </Card>
      ) : submitted ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Pending review</p>
              <p className="text-xs text-muted-foreground">Your profile is hidden from customers until an admin verifies it.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <StepShell
        steps={STEPS}
        currentStep={currentStep}
        onPrev={goPrev}
        onNext={goNext}
        onSaveExit={saveAndExit}
        saving={saving}
        nextLabel={isFinalStep ? "Submit for Verification" : "Next"}
        title="Fundi Verification"
        subtitle={`Step ${currentStep + 1} of ${STEPS.length} — ${STEPS[currentStep].label}`}
      >
        {currentStep === 0 && <PersonalStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 1 && <SkillsStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 2 && <LocationStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 3 && <DocumentsStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 4 && <AcademicStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 5 && <PaymentStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 6 && <WorkHistoryStep data={data} setData={patch} userId={user!.id} />}
        {currentStep === 7 && <ReviewStep data={data} userId={user!.id} />}
        {currentStep === 8 && <AgreementsStep data={data} setData={patch} userId={user!.id} />}
      </StepShell>
    </div>
  );
}
