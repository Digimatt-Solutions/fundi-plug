import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

/**
 * Lightweight QR scanner using BarcodeDetector when available, with manual paste fallback.
 * Emits the decoded URL/text via onScan or navigates if it looks like a verify-fundi link.
 */
interface Props {
  buttonLabel?: string;
  onScan?: (text: string) => void;
}

export default function QRScanner({ buttonLabel = "Scan fundi QR", onScan }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleResult = (text: string) => {
    stop();
    setOpen(false);
    if (onScan) { onScan(text); return; }
    try {
      const url = new URL(text);
      if (url.pathname.startsWith("/verify-fundi/")) {
        navigate(url.pathname);
        return;
      }
    } catch {/* not a url */}
    toast({ title: "Scanned", description: text });
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // @ts-ignore - BarcodeDetector is experimental
      if (typeof window.BarcodeDetector !== "undefined") {
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0) {
              handleResult(codes[0].rawValue);
              return;
            }
          } catch {/* keep going */}
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } else {
        toast({
          title: "Auto-scan not supported on this browser",
          description: "Paste the link below manually.",
        });
      }
    } catch {
      toast({
        title: "Camera unavailable",
        description: "Allow camera access or paste the link below.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) start();
    return stop;
    // eslint-disable-next-line
  }, [open]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <QrCode className="w-3.5 h-3.5" /> {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) stop(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Scan fundi QR code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="aspect-square w-full rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            </div>
            <p className="text-xs text-muted-foreground">
              Point the camera at the fundi's QR code. If your browser doesn't auto-detect,
              paste the link below.
            </p>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Paste verification link"
                className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
              <Button size="sm" onClick={() => manual && handleResult(manual)} disabled={!manual}>
                Open
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
