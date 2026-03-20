import { Shield, Check, X, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const pendingWorkers = [
  { id: 1, name: "Carlos Rivera", skill: "Plumber", submitted: "Mar 18, 2026", docs: 3 },
  { id: 2, name: "Priya Sharma", skill: "Electrician", submitted: "Mar 17, 2026", docs: 2 },
  { id: 3, name: "Thomas Brown", skill: "Carpenter", submitted: "Mar 16, 2026", docs: 4 },
];

export default function VerificationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Worker Verification</h1>
        <p className="text-muted-foreground text-sm">Review and approve worker applications</p>
      </div>

      <div className="space-y-4">
        {pendingWorkers.map((w, i) => (
          <div key={w.id} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {w.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="font-medium text-foreground">{w.name}</p>
                  <p className="text-sm text-muted-foreground">{w.skill}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" /> {w.docs} documents
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" /> {w.submitted}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="active:scale-[0.97]">
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 active:scale-[0.97]">
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
