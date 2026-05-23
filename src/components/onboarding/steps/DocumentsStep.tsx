import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import FileUploader from "../FileUploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Plus, X, FileBadge } from "lucide-react";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

type License = { name: string; file_url: string };

export default function DocumentsStep({ data, setData, userId }: Props) {
  const licenses: License[] = Array.isArray(data.other_licenses) ? data.other_licenses : [];

  const updateLicense = (idx: number, patch: Partial<License>) => {
    const next = licenses.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setData({ other_licenses: next });
  };
  const addLicense = () => setData({ other_licenses: [...licenses, { name: "", file_url: "" }] });
  const removeLicense = (idx: number) =>
    setData({ other_licenses: licenses.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          These documents are private and only visible to you and our verification team. They are never shown to clients.
        </AlertDescription>
      </Alert>

      {/* Required documents */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Required Documents</h3>
          <p className="text-xs text-muted-foreground">All marked with * must be provided to pass verification.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FileUploader
            bucket="verification-docs"
            userId={userId}
            value={data.id_front_url}
            onChange={(url) => setData({ id_front_url: url })}
            label="National ID - Front *"
            helper="Clear photo of front side"
            accept="image/*,application/pdf"
            prefix="id-front"
          />
          <FileUploader
            bucket="verification-docs"
            userId={userId}
            value={data.id_back_url}
            onChange={(url) => setData({ id_back_url: url })}
            label="National ID - Back *"
            helper="Clear photo of back side"
            accept="image/*,application/pdf"
            prefix="id-back"
          />
        </div>

        <FileUploader
          bucket="verification-docs"
          userId={userId}
          value={data.good_conduct_url}
          onChange={(url) => setData({ good_conduct_url: url })}
          label="Certificate of Good Conduct *"
          helper="DCI-issued certificate (PDF or clear photo). Must be valid and unexpired."
          accept="image/*,application/pdf"
          prefix="good-conduct"
        />
      </section>

      {/* Optional registration numbers */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Registration Numbers</h3>
          <p className="text-xs text-muted-foreground">Optional but strongly recommended for paid jobs.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>NCA Number</Label>
            <Input
              placeholder="e.g. NCA/12345"
              value={data.nca_number || ""}
              onChange={(e) => setData({ nca_number: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">National Construction Authority registration, if applicable.</p>
          </div>
          <div className="space-y-2">
            <Label>KRA PIN</Label>
            <Input
              placeholder="e.g. A012345678X"
              value={data.kra_pin || ""}
              onChange={(e) => setData({ kra_pin: (e.target.value || "").toUpperCase() })}
            />
            <p className="text-xs text-muted-foreground">Kenya Revenue Authority PIN - recommended for paid jobs.</p>
          </div>
        </div>
      </section>

      {/* Other Licenses & Clearances */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileBadge className="w-4 h-4 text-primary" />
              Other Licenses & Clearances
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional. Add trade certificates, county permits, EPRA, IEK, KEBS, insurance, etc.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLicense}>
            <Plus className="w-4 h-4 mr-1" /> Add license
          </Button>
        </div>

        {licenses.length === 0 ? (
          <p className="text-xs text-muted-foreground italic border border-dashed border-border rounded-lg p-4 text-center">
            No additional licenses added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {licenses.map((lic, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">License #{idx + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={() => removeLicense(idx)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Input
                  placeholder="License name (e.g. EPRA Electrician T3, County Trade Permit)"
                  value={lic.name}
                  onChange={(e) => updateLicense(idx, { name: e.target.value })}
                />
                <FileUploader
                  bucket="verification-docs"
                  userId={userId}
                  value={lic.file_url}
                  onChange={(url) => updateLicense(idx, { file_url: url || "" })}
                  label=""
                  helper="Upload license document (PDF or photo)"
                  accept="image/*,application/pdf"
                  prefix={`license-${idx}`}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
