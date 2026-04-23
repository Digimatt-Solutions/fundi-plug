import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FileUploader from "../FileUploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

export default function DocumentsStep({ data, setData, userId }: Props) {
  return (
    <div className="space-y-5">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          These documents are private and only visible to you and our verification team. They are never shown to clients.
        </AlertDescription>
      </Alert>

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

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>NCA Number (optional)</Label>
          <Input
            placeholder="e.g. NCA/12345"
            value={data.nca_number || ""}
            onChange={(e) => setData({ nca_number: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">National Construction Authority registration, if applicable.</p>
        </div>
        <div className="space-y-2">
          <Label>KRA PIN (optional)</Label>
          <Input
            placeholder="e.g. A012345678X"
            value={data.kra_pin || ""}
            onChange={(e) => setData({ kra_pin: (e.target.value || "").toUpperCase() })}
          />
          <p className="text-xs text-muted-foreground">Kenya Revenue Authority PIN - recommended for paid jobs.</p>
        </div>
      </div>
    </div>
  );
}
