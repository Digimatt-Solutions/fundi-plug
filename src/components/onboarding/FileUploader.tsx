import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileUploaderProps {
  bucket: "avatars" | "portfolio" | "verification-docs";
  userId: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  accept?: string;
  helper?: string;
  prefix?: string; // optional sub-folder under userId/
}

export default function FileUploader({
  bucket,
  userId,
  value,
  onChange,
  label = "Upload",
  accept = "image/*",
  helper,
  prefix,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const isImage = value && /\.(png|jpe?g|webp|gif|avif)$/i.test(value);

  async function upload(f: File) {
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() || "bin";
      const path = `${userId}/${prefix ? prefix + "/" : ""}${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, f, { upsert: true });
      if (error) throw error;

      let url: string;
      if (bucket === "verification-docs") {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
        url = data?.signedUrl || path;
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        url = data.publicUrl;
      }
      onChange(url);
      toast({ title: "Uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <div className="rounded-lg border border-dashed border-border p-3 bg-muted/30 flex items-center gap-3">
        {value ? (
          isImage ? (
            <img src={value} alt="preview" className="w-16 h-16 object-cover rounded-md border" />
          ) : (
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
          )
        ) : (
          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            {value ? value.split("/").pop()?.split("?")[0] : helper || "PNG, JPG or PDF up to 10 MB"}
          </p>
          <div className="flex gap-2 mt-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              {value ? "Replace" : "Choose file"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
                <X className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
