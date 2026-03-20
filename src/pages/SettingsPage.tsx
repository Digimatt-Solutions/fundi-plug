import { Settings, Bell, Shield, CreditCard, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Platform configuration</p>
      </div>

      <div className="space-y-4">
        {/* General */}
        <div className="stat-card animate-fade-in">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> General
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input defaultValue="SkillHub" className="bg-muted/50 max-w-sm" />
            </div>
            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <Input type="number" defaultValue="15" className="bg-muted/50 max-w-sm" />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="stat-card animate-fade-in" style={{ animationDelay: "100ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Notifications
          </h3>
          <div className="space-y-4">
            {["Email notifications", "Push notifications", "Job alerts", "Payment alerts"].map((item) => (
              <div key={item} className="flex items-center justify-between">
                <Label>{item}</Label>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="stat-card animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Security
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Two-Factor Authentication</Label>
              <Switch />
            </div>
            <Button variant="outline" size="sm">Change Password</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
