import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, Mail, Lock, User } from "lucide-react";
import logo from "@/assets/logo.png";

export default function SetupAdminPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (error) { setChecking(false); return; }
      if (data === true) {
        navigate("/auth", { replace: true });
        return;
      }
      setChecking(false);
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("setup-admin", {
      body: { email, password, name },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Setup failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "Admin created", description: "Check your email to verify the account." });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 sm:p-8 animate-fade-in">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={logo} alt="Logo" className="w-14 h-14 mb-3" />
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> One-time setup
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Create the Admin Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            No admin exists yet. Set up the platform administrator below. A verification link will be sent to the email provided.
          </p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              Admin created. We've sent a verification email to <strong>{email}</strong>. Click the link to verify, then sign in.
            </div>
            <Button className="w-full" onClick={() => navigate("/auth")}>Go to Sign In</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin name" className="pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className="pl-10" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Admin"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You can change this password anytime from Settings after signing in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
