import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FileUploader from "../FileUploader";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

const BIO_MAX = 500;

export default function PersonalStep({ data, setData, userId }: Props) {
  const bioLen = (data.bio || "").length;

  return (
    <div className="space-y-5">
      {/* Profile photo + selfie */}
      <div className="grid sm:grid-cols-2 gap-4">
        <FileUploader
          bucket="avatars"
          userId={userId}
          value={data.profile_photo_url}
          onChange={(url) => setData({ profile_photo_url: url })}
          label="Profile Photo *"
          helper="Clear face photo, JPG/PNG"
        />
        <FileUploader
          bucket="verification-docs"
          userId={userId}
          value={data.selfie_with_id_url}
          onChange={(url) => setData({ selfie_with_id_url: url })}
          label="Selfie holding your ID *"
          helper="Hold your National ID next to your face"
          prefix="selfie-id"
        />
      </div>

      {/* Names */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label>First Name *</Label>
          <Input value={data.first_name || ""} onChange={(e) => setData({ first_name: e.target.value })} />
        </div>
        <div>
          <Label>Middle Name</Label>
          <Input value={data.middle_name || ""} onChange={(e) => setData({ middle_name: e.target.value })} />
        </div>
        <div>
          <Label>Last Name *</Label>
          <Input value={data.last_name || ""} onChange={(e) => setData({ last_name: e.target.value })} />
        </div>
      </div>

      {/* Contact */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Alternate Phone</Label>
          <Input
            placeholder="07xx xxx xxx"
            value={data.alt_phone || ""}
            onChange={(e) => setData({ alt_phone: e.target.value })}
          />
        </div>
        <div>
          <Label>Date of Birth *</Label>
          <Input
            type="date"
            value={data.date_of_birth || ""}
            onChange={(e) => setData({ date_of_birth: e.target.value })}
          />
        </div>
        <div>
          <Label>Gender</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={data.gender || ""}
            onChange={(e) => setData({ gender: e.target.value })}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Prefer not to say</option>
          </select>
        </div>
        <div>
          <Label>National ID Number *</Label>
          <Input
            value={data.id_number || ""}
            onChange={(e) => setData({ id_number: e.target.value })}
          />
        </div>
      </div>

      {/* Next of kin */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <p className="text-sm font-medium text-foreground">Next of Kin *</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Full Name</Label>
            <Input
              value={data.next_of_kin_name || ""}
              onChange={(e) => setData({ next_of_kin_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Relationship</Label>
            <Input
              placeholder="Spouse, Parent, Sibling…"
              value={data.next_of_kin_relationship || ""}
              onChange={(e) => setData({ next_of_kin_relationship: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              placeholder="07xx xxx xxx"
              value={data.next_of_kin_phone || ""}
              onChange={(e) => setData({ next_of_kin_phone: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Bio */}
      <div>
        <div className="flex justify-between items-center">
          <Label>Bio *</Label>
          <span className={`text-xs ${bioLen > BIO_MAX ? "text-destructive" : "text-muted-foreground"}`}>
            {bioLen}/{BIO_MAX}
          </span>
        </div>
        <Textarea
          rows={4}
          maxLength={BIO_MAX}
          placeholder="Briefly introduce yourself: years in trade, specialties, what makes you reliable…"
          value={data.bio || ""}
          onChange={(e) => setData({ bio: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Tip: Mention your strongest skill, typical projects, and your work ethic. Avoid contact info here.
        </p>
      </div>
    </div>
  );
}
