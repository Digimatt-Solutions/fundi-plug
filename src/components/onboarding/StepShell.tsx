import { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface Step {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface StepShellProps {
  steps: Step[];
  currentStep: number;
  onPrev?: () => void;
  onNext?: () => void;
  onSaveExit?: () => void;
  saving?: boolean;
  nextLabel?: string;
  canNext?: boolean;
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function StepShell({
  steps,
  currentStep,
  onPrev,
  onNext,
  onSaveExit,
  saving,
  nextLabel = "Next",
  canNext = true,
  children,
  title,
  subtitle,
}: StepShellProps) {
  const pct = Math.round(((currentStep + 1) / steps.length) * 100);
  const active = steps[currentStep];

  return (
    <div className="space-y-5">
      {/* Header + progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title || "Fundi Onboarding"}</h1>
            <p className="text-sm text-muted-foreground">
              {subtitle || `Step ${currentStep + 1} of ${steps.length} — ${active?.label}`}
            </p>
          </div>
          {onSaveExit && (
            <Button variant="outline" size="sm" onClick={onSaveExit} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" /> Save & Exit
            </Button>
          )}
        </div>
        <Progress value={pct} className="h-2" />
        {/* Step pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs whitespace-nowrap border transition-colors",
                i === currentStep
                  ? "bg-primary text-primary-foreground border-primary"
                  : i < currentStep
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground border-transparent",
              ].join(" ")}
            >
              {s.icon}
              <span className="font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            {active?.icon}
            {active?.label}
          </h2>
        </CardHeader>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="outline" onClick={onPrev} disabled={!onPrev || currentStep === 0 || saving}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <Button onClick={onNext} disabled={!onNext || !canNext || saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
          {nextLabel}
          {!saving && <ArrowRight className="w-4 h-4 ml-1.5" />}
        </Button>
      </div>
    </div>
  );
}
