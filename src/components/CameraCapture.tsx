import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Loader2, X, Check, SwitchCamera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  bucket: "avatars" | "verification-docs";
  userId: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  label: string;
  helper?: string;
  prefix?: string;
  /** Default front-facing for selfies, rear for documents */
  facing?: "user" | "environment";
}

/**
 * Forces an INSTANT photo from the device camera. No file picker / gallery.
 * Used for selfie-with-ID and profile photo to prevent reusing old images.
 */
export default function CameraCapture({
  bucket, userId, value, onChange, label, helper, prefix, facing = "user",
}: Props) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapped, setSnapped] = useState<string | null>(null);
  const [currentFacing, setCurrentFacing] = useState<"user" | "environment">(facing);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async (mode: "user" | "environment") => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      toast({
        title: "Camera unavailable",
        description: "Please allow camera access in your browser settings.",
        variant: "destructive",
      });
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open && !snapped) startCamera(currentFacing);
    return () => { if (!open) stopStream(); };
    // eslint-disable-next-line
  }, [open, currentFacing]);

  const flip = () => {
    setCurrentFacing((p) => (p === "user" ? "environment" : "user"));
  };

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const data = canvas.toDataURL("image/jpeg", 0.9);
    setSnapped(data);
    stopStream();
  };

  const retake = () => {
    setSnapped(null);
    startCamera(currentFacing);
  };

  const confirm = async () => {
    if (!snapped) return;
    setBusy(true);
    try {
      const blob = await (await fetch(snapped)).blob();
      const path = `${userId}/${prefix ? prefix + "/" : ""}live-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        upsert: true, contentType: "image/jpeg",
      });
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
      toast({ title: "Photo saved" });
      setOpen(false);
      setSnapped(null);
    } catch (e: any) {
      toast({ title: "Could not save photo", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const closeAll = () => {
    stopStream();
    setSnapped(null);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="rounded-lg border border-dashed border-border p-3 bg-muted/30 flex items-center gap-3">
        {value ? (
          <img loading="lazy" decoding="async" src={value} alt="preview" className="w-16 h-16 object-cover rounded-md border" />
        ) : (
          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
            <Camera className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {value ? "Live photo captured" : helper || "Live camera photo only - no gallery uploads"}
          </p>
          <div className="flex gap-2 mt-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={busy}>
              <Camera className="w-3.5 h-3.5 mr-1" />
              {value ? "Retake" : "Open camera"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
                <X className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center justify-between text-white">
              <p className="text-sm font-medium">{label}</p>
              <Button size="icon" variant="ghost" onClick={closeAll} className="text-white hover:text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-black">
              {snapped ? (
                <img src={snapped} alt="snap" className="w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              {!snapped ? (
                <>
                  <Button size="lg" variant="outline" onClick={flip} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <SwitchCamera className="w-4 h-4 mr-1" /> Flip
                  </Button>
                  <Button size="lg" onClick={snap} className="rounded-full w-16 h-16 p-0">
                    <Camera className="w-6 h-6" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" variant="outline" onClick={retake} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <RefreshCw className="w-4 h-4 mr-1" /> Retake
                  </Button>
                  <Button size="lg" onClick={confirm} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Use this photo
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
