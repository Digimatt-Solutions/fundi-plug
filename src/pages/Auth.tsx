import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Eye, EyeOff, Phone, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/workers-hero.jpg";
import logo from "@/assets/logo.png";

const Auth = () => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, signup, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Reset OTP state when switching tabs
  const resetOtpState = useCallback(() => {
    setOtpSent(false);
    setOtpCode("");
    setOtpVerified(false);
    setResendTimer(0);
    setPhoneNumber("");
  }, []);

  const handleSendOtp = async () => {
    const kenyanRegex = /^254[17]\d{8}$/;
    if (!kenyanRegex.test(phoneNumber)) {
      setError("Invalid phone number. Use format 2547XXXXXXXX or 2541XXXXXXXX");
      return;
    }
    setError("");
    setOtpLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-otp", {
        body: { phone_number: phoneNumber },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      setResendTimer(60);
      toast({ title: "Code sent", description: "Check your phone for the verification code." });
    } catch (err: any) {
      setError(err.message || "Failed to send code");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter a valid 6-digit code");
      return;
    }
    setError("");
    setOtpLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-otp", {
        body: { phone_number: phoneNumber, otp: otpCode },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (data?.verified) {
        setOtpVerified(true);
        toast({ title: "Phone verified", description: "You can now create your account." });
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignIn) {
        await login(email, password);
      } else {
        await signup(email, password, name, role);
        // Update phone on profile after signup
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ phone: phoneNumber }).eq("id", user.id);
        }
        toast({
          title: "Account created",
          description: "Please check your email for verification, or sign in if auto-confirmed.",
        });
      }
    } catch (err: any) {
      const msg = err.message || "Something went wrong";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  const signupDisabled = !isSignIn && !otpVerified;

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={heroImage} alt="Skilled workers on site" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-3xl font-bold leading-tight mb-3" style={{ textWrap: "balance" as any }}>
            Connect with Skilled Professionals
          </h2>
          <p className="text-white/70 text-lg max-w-md">
            Find verified electricians, plumbers, carpenters and more - on demand or scheduled.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-card p-8 dark:bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="border border-border rounded-2xl p-6 bg-card/50">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden mb-4">
                <img src={logo} alt="FundiPlug" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">FundiPlug</h1>
              <p className="text-muted-foreground text-sm mt-1">Skilled Workers Marketplace</p>
            </div>

            <div className="flex bg-muted rounded-lg p-1 mb-6">
              <button
                onClick={() => { setIsSignIn(true); setError(""); resetOtpState(); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  isSignIn ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setIsSignIn(false); setError(""); resetOtpState(); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  !isSignIn ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isSignIn && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="name" className="text-foreground font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="pl-10 h-12 bg-muted/50 border-border" required />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 h-12 bg-muted/50 border-border" required />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                  {isSignIn && (
                    <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10 h-12 bg-muted/50 border-border" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Phone OTP Section - Sign Up only */}
              {!isSignIn && (
                <div className="space-y-3 animate-fade-in">
                  <Label className="text-foreground font-medium">Phone Number</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="2547XXXXXXXX"
                        className="pl-10 h-12 bg-muted/50 border-border"
                        disabled={otpVerified}
                        required
                      />
                    </div>
                    {!otpVerified && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendOtp}
                        disabled={otpLoading || resendTimer > 0 || !phoneNumber}
                        className="h-12 px-4 whitespace-nowrap"
                      >
                        {otpLoading ? "Sending..." : resendTimer > 0 ? `Resend (${resendTimer}s)` : otpSent ? "Resend" : "Send Code"}
                      </Button>
                    )}
                    {otpVerified && (
                      <div className="flex items-center gap-1 text-green-600 px-3">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-sm font-medium">Verified</span>
                      </div>
                    )}
                  </div>

                  {otpSent && !otpVerified && (
                    <div className="flex gap-2 animate-fade-in">
                      <div className="relative flex-1">
                        <Input
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="Enter 6-digit code"
                          className="h-12 bg-muted/50 border-border text-center tracking-widest text-lg"
                          maxLength={6}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpLoading || otpCode.length !== 6}
                        className="h-12 px-4"
                      >
                        {otpLoading ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {!isSignIn && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-foreground font-medium">I am a</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["customer", "worker"] as UserRole[]).map((r) => (
                      <button key={r} type="button" onClick={() => setRole(r)}
                        className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all duration-200 capitalize ${
                          role === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {r === "worker" ? "Fundi" : r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || signupDisabled}
                className="w-full h-12 text-base font-semibold rounded-lg active:scale-[0.98] transition-transform"
              >
                {loading ? "Please wait..." : isSignIn ? "Sign In" : "Create Account"}
              </Button>

              {signupDisabled && !isSignIn && (
                <p className="text-xs text-muted-foreground text-center">Verify your phone number to create an account</p>
              )}
            </form>

            <div className="mt-6 text-center space-y-1">
              <p className="text-xs text-muted-foreground">© Digimatt Solutions 2026</p>
              <button className="text-xs text-primary hover:underline">Privacy Policy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
