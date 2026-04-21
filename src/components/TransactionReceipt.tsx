import { useRef } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import mpesaLogo from "@/assets/mpesa-logo.png";
import stripeLogo from "@/assets/stripe-logo.png";
import appLogo from "@/assets/logo.png";

interface ReceiptData {
  id: string;
  type: "payment" | "withdrawal";
  amount: number;
  commission?: number;
  status: string;
  date: string;
  paymentMethod?: string;
  jobTitle?: string;
  payerName?: string;
  payeeName?: string;
  workerName?: string;
  adminNotes?: string;
  phone?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

function getPaymentMethod(stripePaymentId?: string | null): "mpesa" | "stripe" | "pesapal" | "unknown" {
  if (!stripePaymentId) return "unknown";
  if (stripePaymentId.startsWith("mpesa_")) return "mpesa";
  if (stripePaymentId.startsWith("pesapal_")) return "pesapal";
  return "stripe";
}

export { getPaymentMethod };

// Convert image URLs to base64 for print
async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export default function TransactionReceipt({ open, onClose, data }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const method = data.paymentMethod === "mpesa" ? "mpesa" : data.paymentMethod === "stripe" ? "stripe" : "unknown";
  const totalAmount = data.type === "payment" ? data.amount + (data.commission || 0) : data.amount;

  const handleDownload = async () => {
    const el = receiptRef.current;
    if (!el) return;

    // Convert images to base64 for print
    const [appLogoB64, mpesaLogoB64, stripeLogoB64] = await Promise.all([
      imageToBase64(appLogo),
      imageToBase64(mpesaLogo),
      imageToBase64(stripeLogo),
    ]);

    // Clone and replace image srcs
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (src.includes("logo.png") || src.includes("logo")) img.src = appLogoB64;
      else if (src.includes("mpesa")) img.src = mpesaLogoB64;
      else if (src.includes("stripe")) img.src = stripeLogoB64;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receipt - ${data.id.slice(0, 8)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; background: #fff; color: #1a1a1a; }
        .receipt { max-width: 440px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 16px; padding: 36px 28px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 2px dashed #ddd; }
        .header img.app-logo { height: 40px; margin-bottom: 10px; display: inline-block; }
        .header h2 { font-size: 18px; font-weight: 700; margin-bottom: 2px; color: #111; }
        .header p { font-size: 11px; color: #888; }
        img.method-logo { height: 22px; vertical-align: middle; display: inline-block; }
        .ids { margin-bottom: 12px; }
        .row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 13px; }
        .row .label { color: #777; }
        .row .value { font-weight: 600; text-align: right; max-width: 60%; color: #222; }
        .row .value.mono { font-family: monospace; font-size: 11px; }
        .row .value.uuid { font-family: monospace; font-size: 9px; color: #999; word-break: break-all; }
        .divider { border: none; border-top: 1px solid #eee; margin: 10px 0; }
        .total-row { font-size: 16px; font-weight: 700; padding: 10px 0; display: flex; justify-content: space-between; }
        .total-row .value { color: #e65100; }
        .status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
        .status-badge.completed { background: #dcfce7; color: #16a34a; }
        .status-badge.pending { background: #fef3c7; color: #d97706; }
        .status-badge.failed { background: #fee2e2; color: #dc2626; }
        .status-badge.approved { background: #dbeafe; color: #2563eb; }
        .status-badge.rejected { background: #fee2e2; color: #dc2626; }
        .method-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 13px; }
        .method-row .label { color: #777; }
        .method-row .value { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #222; }
        .footer { text-align: center; margin-top: 18px; padding-top: 16px; border-top: 2px dashed #ddd; }
        .footer p { font-size: 11px; color: #999; line-height: 1.6; }
        .footer .company { font-weight: 600; color: #666; font-size: 11px; margin-top: 6px; }
        @media print { body { padding: 0; } .receipt { border: none; box-shadow: none; } }
      </style></head><body>
      <div class="receipt">
        <div class="header">
          <img src="${appLogoB64}" alt="FundiPlug" class="app-logo" />
          <h2>${data.type === "payment" ? "Payment Receipt" : "Withdrawal Receipt"}</h2>
          <p>${new Date(data.date).toLocaleString()}</p>
        </div>
        <div class="ids">
          <div class="row"><span class="label">Receipt ID</span><span class="value mono">${data.id.slice(0, 8).toUpperCase()}</span></div>
          <div class="row"><span class="label">Transaction UUID</span><span class="value uuid">${data.id}</span></div>
        </div>
        <hr class="divider" />
        ${data.type === "payment" ? `
          ${data.jobTitle ? `<div class="row"><span class="label">Service</span><span class="value">${data.jobTitle}</span></div>` : ""}
          ${data.payerName ? `<div class="row"><span class="label">Paid By</span><span class="value">${data.payerName}</span></div>` : ""}
          ${data.payeeName ? `<div class="row"><span class="label">Paid To</span><span class="value">${data.payeeName}</span></div>` : ""}
          <hr class="divider" />
          <div class="row"><span class="label">Service Amount</span><span class="value">KSH ${data.amount.toLocaleString()}</span></div>
          ${data.commission && data.commission > 0 ? `<div class="row"><span class="label">Platform Fee</span><span class="value">KSH ${data.commission.toLocaleString()}</span></div>` : ""}
          <hr class="divider" />
          <div class="total-row"><span>Total Paid</span><span class="value">KSH ${totalAmount.toLocaleString()}</span></div>
        ` : `
          ${data.workerName ? `<div class="row"><span class="label">Fundi</span><span class="value">${data.workerName}</span></div>` : ""}
          ${data.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${data.phone}</span></div>` : ""}
          ${data.adminNotes ? `<div class="row"><span class="label">Notes</span><span class="value">${data.adminNotes}</span></div>` : ""}
          <hr class="divider" />
          <div class="total-row"><span>Amount Disbursed</span><span class="value">KSH ${data.amount.toLocaleString()}</span></div>
        `}
        <hr class="divider" />
        <div class="row"><span class="label">Status</span><span class="value"><span class="status-badge ${data.status}">${data.status}</span></span></div>
        <div class="method-row"><span class="label">Payment Method</span><span class="value">${method !== "unknown" ? `<img src="${method === "mpesa" ? mpesaLogoB64 : stripeLogoB64}" alt="${method}" class="method-logo" />` : ""}${method === "unknown" ? "N/A" : method === "mpesa" ? "M-Pesa" : "Stripe"}</span></div>
        <div class="footer">
          <p>Thank you for your business</p>
          <p>This is a computer-generated receipt</p>
          <p class="company">Digimatt Solutions Limited</p>
        </div>
      </div>
      <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center justify-between">
            Transaction Receipt
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div ref={receiptRef} className="bg-background px-6 pb-6 pt-4 space-y-3">
          {/* Header with App Logo */}
          <div className="text-center border-b-2 border-dashed border-border pb-4">
            <img src={appLogo} alt="FundiPlug" className="h-10 mx-auto mb-2 object-contain" />
            <h2 className="text-lg font-bold text-foreground">
              {data.type === "payment" ? "Payment Receipt" : "Withdrawal Receipt"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(data.date).toLocaleString()}
            </p>
          </div>

          {/* IDs */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Receipt ID</span>
              <span className="font-mono text-xs font-semibold text-foreground">{data.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction UUID</span>
              <span className="font-mono text-[10px] text-muted-foreground break-all max-w-[55%] text-right">{data.id}</span>
            </div>
          </div>

          <hr className="border-border" />

          {/* Payment Details */}
          {data.type === "payment" && (
            <>
              {data.jobTitle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-foreground text-right max-w-[60%]">{data.jobTitle}</span>
                </div>
              )}
              {data.payerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid By</span>
                  <span className="font-medium text-foreground">{data.payerName}</span>
                </div>
              )}
              {data.payeeName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid To</span>
                  <span className="font-medium text-foreground">{data.payeeName}</span>
                </div>
              )}
              <hr className="border-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Amount</span>
                <span className="text-foreground tabular-nums font-medium">KSH {data.amount.toLocaleString()}</span>
              </div>
              {data.commission !== undefined && data.commission > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <span className="text-foreground tabular-nums">KSH {data.commission.toLocaleString()}</span>
                </div>
              )}
              <hr className="border-border" />
              <div className="flex justify-between items-center py-1">
                <span className="text-base font-bold text-foreground">Total Paid</span>
                <span className="text-lg font-bold text-primary tabular-nums">KSH {totalAmount.toLocaleString()}</span>
              </div>
            </>
          )}

          {/* Withdrawal Details */}
          {data.type === "withdrawal" && (
            <>
              {data.workerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fundi</span>
                  <span className="font-medium text-foreground">{data.workerName}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="text-foreground">{data.phone}</span>
                </div>
              )}
              {data.adminNotes && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Notes</span>
                  <span className="text-foreground text-right max-w-[60%]">{data.adminNotes}</span>
                </div>
              )}
              <hr className="border-border" />
              <div className="flex justify-between items-center py-1">
                <span className="text-base font-bold text-foreground">Amount Disbursed</span>
                <span className="text-lg font-bold text-primary tabular-nums">KSH {data.amount.toLocaleString()}</span>
              </div>
            </>
          )}

          {/* Status & Method */}
          <hr className="border-border" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
              data.status === "completed" ? "bg-green-500/10 text-green-500" :
              data.status === "approved" ? "bg-blue-500/10 text-blue-500" :
              data.status === "pending" ? "bg-chart-4/10 text-chart-4" :
              "bg-destructive/10 text-destructive"
            }`}>{data.status}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <div className="flex items-center gap-2">
              {method !== "unknown" && (
                <img src={method === "mpesa" ? mpesaLogo : stripeLogo} alt={method} className="h-5 object-contain" />
              )}
              <span className="text-foreground capitalize font-medium">{method === "unknown" ? "N/A" : method === "mpesa" ? "M-Pesa" : "Stripe"}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t-2 border-dashed border-border space-y-1">
            <p className="text-xs text-muted-foreground">Thank you for your business</p>
            <p className="text-xs text-muted-foreground">This is a computer-generated receipt</p>
            <p className="text-[11px] font-semibold text-muted-foreground pt-2">Digimatt Solutions Limited</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
