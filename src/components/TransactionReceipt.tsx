import { useRef } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import mpesaLogo from "@/assets/mpesa-logo.png";
import stripeLogo from "@/assets/stripe-logo.png";

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

function getPaymentMethod(stripePaymentId?: string | null): "mpesa" | "stripe" | "unknown" {
  if (!stripePaymentId) return "unknown";
  if (stripePaymentId.startsWith("mpesa_")) return "mpesa";
  return "stripe";
}

export { getPaymentMethod };

export default function TransactionReceipt({ open, onClose, data }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const method = data.paymentMethod === "mpesa" ? "mpesa" : data.paymentMethod === "stripe" ? "stripe" : "unknown";
  const totalAmount = data.type === "payment" ? data.amount + (data.commission || 0) : data.amount;

  const handleDownload = () => {
    const el = receiptRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receipt - ${data.id.slice(0, 8)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; background: #fff; color: #1a1a1a; }
        .receipt { max-width: 420px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px dashed #e5e5e5; padding-bottom: 20px; }
        .header h2 { font-size: 20px; margin-bottom: 4px; }
        .header p { font-size: 12px; color: #666; }
        .logo { height: 28px; margin-bottom: 12px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
        .row .label { color: #666; }
        .row .value { font-weight: 600; text-align: right; max-width: 60%; }
        .divider { border-top: 1px solid #e5e5e5; margin: 12px 0; }
        .total-row { font-size: 16px; font-weight: 700; }
        .status { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
        .status.completed { background: #dcfce7; color: #16a34a; }
        .status.pending { background: #fef3c7; color: #d97706; }
        .status.failed { background: #fee2e2; color: #dc2626; }
        .footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 2px dashed #e5e5e5; font-size: 11px; color: #999; }
        .method-logo { height: 22px; vertical-align: middle; }
        @media print { body { padding: 0; } .receipt { border: none; } }
      </style></head><body>
      <div class="receipt">${el.innerHTML}</div>
      <script>window.print(); window.onafterprint = () => window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Transaction Receipt
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div ref={receiptRef} className="bg-background rounded-xl p-6 space-y-4">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-border pb-4">
            {method !== "unknown" && (
              <img
                src={method === "mpesa" ? mpesaLogo : stripeLogo}
                alt={method === "mpesa" ? "M-Pesa" : "Stripe"}
                className="h-7 mx-auto mb-2 object-contain"
              />
            )}
            <h2 className="text-lg font-bold text-foreground">
              {data.type === "payment" ? "Payment Receipt" : "Withdrawal Receipt"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(data.date).toLocaleString()}
            </p>
          </div>

          {/* Transaction ID */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Receipt ID</span>
            <span className="font-mono text-xs text-foreground">{data.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Transaction UUID</span>
            <span className="font-mono text-xs text-foreground break-all">{data.id}</span>
          </div>

          <div className="border-t border-border" />

          {/* Details */}
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
              <div className="border-t border-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Amount</span>
                <span className="text-foreground tabular-nums">KSH {data.amount.toLocaleString()}</span>
              </div>
              {data.commission !== undefined && data.commission > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <span className="text-foreground tabular-nums">KSH {data.commission.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-border" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Total Paid</span>
                <span className="text-foreground tabular-nums">KSH {totalAmount.toLocaleString()}</span>
              </div>
            </>
          )}

          {data.type === "withdrawal" && (
            <>
              {data.workerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Worker</span>
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
              <div className="border-t border-border" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Amount Disbursed</span>
                <span className="text-foreground tabular-nums">KSH {data.amount.toLocaleString()}</span>
              </div>
            </>
          )}

          {/* Status */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
              data.status === "completed" ? "bg-green-500/10 text-green-500" :
              data.status === "pending" ? "bg-chart-4/10 text-chart-4" :
              "bg-destructive/10 text-destructive"
            }`}>{data.status}</span>
          </div>

          {/* Payment Method */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <div className="flex items-center gap-2">
              {method !== "unknown" && (
                <img
                  src={method === "mpesa" ? mpesaLogo : stripeLogo}
                  alt={method}
                  className="h-5 object-contain"
                />
              )}
              <span className="text-foreground capitalize">{method === "unknown" ? "N/A" : method === "mpesa" ? "M-Pesa" : "Stripe"}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t-2 border-dashed border-border">
            <p className="text-xs text-muted-foreground">Thank you for your business</p>
            <p className="text-xs text-muted-foreground mt-1">This is a computer-generated receipt</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
