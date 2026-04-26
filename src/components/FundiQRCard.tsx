import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  workerUserId: string;
  workerName?: string;
}

/**
 * Per-fundi unique QR. Encodes a URL that opens the fundi-verify page.
 * Clients scan it on arrival to confirm the right person showed up.
 */
export default function FundiQRCard({ workerUserId, workerName }: Props) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const verifyUrl = `${window.location.origin}/verify-fundi/${workerUserId}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, verifyUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    });
  }, [verifyUrl]);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    const link = document.createElement("a");
    link.download = `fundi-qr-${(workerName || "code").replace(/\s+/g, "-")}.png`;
    link.href = c.toDataURL("image/png");
    link.click();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" /> Your verification QR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          When you arrive at a job site, the client can scan this code to confirm you are the fundi they hired.
          Save it on your phone or print it on your work badge.
        </p>
        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/40 p-4">
          <canvas ref={canvasRef} className="rounded-md bg-white" />
          <p className="text-xs text-muted-foreground break-all text-center">{verifyUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={download} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download QR
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
