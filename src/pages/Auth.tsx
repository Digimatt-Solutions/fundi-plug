import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Eye, EyeOff, Phone, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/fundiplug1.png";
import fundiplugLogo from "@/assets/fundiplug-logo.png";
import { playSubmitSound } from "@/lib/sound";
import logo from "@/assets/logo.png";
import AuthVoiceButton from "@/components/voice/AuthVoiceButton";
import AuthFingerprintButton from "@/components/voice/AuthFingerprintButton";
import { friendlyError } from "@/lib/friendlyError";
import PasswordStrength, { scorePassword } from "@/components/auth/PasswordStrength";

type Mode = "signin" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<Mode>("signin");
  const isSignIn = mode === "signin";
  const isForgot = mode === "forgot";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [lockNow, setLockNow] = useState<number>(Date.now());
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [showVoiceRow, setShowVoiceRow] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const { login, signup, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Phone OTP state (signup AND forgot-password)
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot-password specific state
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      setShowVoiceRow(false);
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
      setError(friendlyError(err, "Couldn't send the code. Please try again."));
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
      setError(friendlyError(err, "We couldn't verify that code. Please try again."));
    } finally {
      setOtpLoading(false);
    }
  };

  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError("Enter the email associated with your account");
      return;
    }
    setError("");
    setResetting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetEmailSent(true);
      toast({
        title: "Check your email",
        description: "We sent a password reset link. Open it to set a new password.",
      });
    } catch (err: any) {
      setError(friendlyError(err, "We couldn't send the reset email. Please try again."));
    } finally {
      setResetting(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgot) {
      await handleResetPassword();
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (isSignIn) {
        await login(email, password);
        // Cache password for fingerprint sign-in on this device (only for this user's enrolled creds)
        try {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) {
            const { data: creds } = await supabase
              .from("webauthn_credentials")
              .select("credential_id")
              .eq("user_id", u.id);
            (creds || []).forEach((c: any) => {
              localStorage.setItem(`fp_secret_${c.credential_id}`, JSON.stringify({ email, password }));
            });
          }
        } catch { /* non-fatal */ }
        playSubmitSound();
      } else {
        await signup(email, password, name, role);
        // Update phone on profile after signup
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ phone: phoneNumber }).eq("id", user.id);
        }
        playSubmitSound();
        toast({
          title: "Account created",
          description: "Please check your email for verification, or sign in if auto-confirmed.",
        });
      }
    } catch (err: any) {
      // For locked / attempts-remaining errors, preserve the server's exact
      // message so the user sees the lockout countdown verbatim.
      const isAuthSignal = err?.locked || typeof err?.attempts_remaining === "number";
      const msg = isAuthSignal ? (err?.message || "Sign in failed") : friendlyError(err);
      setError(msg);
      if (err?.locked && err?.locked_until) {
        setLockedUntil(err.locked_until);
        setAttemptsRemaining(null);
        toast({ title: "Account locked", description: msg, variant: "destructive" });
      } else if (typeof err?.attempts_remaining === "number") {
        setAttemptsRemaining(err.attempts_remaining);
        setLockedUntil(null);
        toast({ title: "Wrong password", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Sign in problem", description: msg, variant: "destructive" });
      }
      setLoading(false);
    }

  };

  // Tick every second to update lockout countdown.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setLockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const lockMsLeft = lockedUntil ? new Date(lockedUntil).getTime() - lockNow : 0;
  useEffect(() => {
    if (lockedUntil && lockMsLeft <= 0) {
      setLockedUntil(null);
      setError("");
    }
  }, [lockMsLeft, lockedUntil]);

  function formatRemaining(ms: number): string {
    if (ms <= 0) return "0s";
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const signupDisabled =
    !isSignIn && !isForgot && (!otpVerified || password.length < 12 || scorePassword(password) < 3);
  const resetDisabled = isForgot && (!email || resetEmailSent);

  return (
    <div className="flex min-h-screen">
      <h1 className="sr-only">Sign in to FundiPlug</h1>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img fetchPriority="high" decoding="async" src={heroImage} alt="Skilled workers on site" className="absolute inset-0 w-full h-full object-cover" />
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

      <div className="flex-1 flex items-center justify-center bg-card p-3 sm:p-6 md:p-8 dark:bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="border border-primary/60 rounded-2xl p-4 sm:p-6 bg-card/50 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]">
            <div className="text-center mb-8">
              <a
                href="https://fundiplug.ke"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden mb-4">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={logo}
                    alt="FundiPlug"
                    className="w-full h-full object-cover"
                  />
                </div>
              </a>
              <a
                  href="https://fundiplug.ke"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={fundiplugLogo}
                    alt="FundiPlug"
                    className="mx-auto h-6 sm:h-6 w-auto object-contain mb-3 dark:invert"
                  />
                </a>
              <p className="text-muted-foreground text-sm">Skilled Workers Marketplace</p>
            </div>

            {!isForgot && isSignIn && showVoiceRow && (
              <div className="mb-4 animate-fade-in">
                <AuthVoiceButton autoStart />
              </div>
            )}

            {!isForgot && (
              <div className="flex bg-muted rounded-lg p-1 mb-6">
                <button
                  onClick={() => { setMode("signin"); setError(""); resetOtpState(); setResetEmailSent(false); }}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    isSignIn ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode("signup"); setError(""); resetOtpState(); setResetEmailSent(false); }}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    !isSignIn ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {isForgot && (
              <div className="mb-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(""); resetOtpState(); setResetEmailSent(false); setNewPassword(""); }}
                  className="text-xs text-primary hover:underline"
                >
                  ← Back to Sign In
                </button>
                <span className="text-sm font-semibold text-foreground ml-auto">Reset Password</span>
              </div>
            )}

            {lockedUntil && lockMsLeft > 0 ? (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
                <p className="font-semibold mb-1">Account temporarily locked</p>
                <p className="text-xs opacity-90">Too many failed attempts. Try again in <span className="font-mono font-semibold">{formatRemaining(lockMsLeft)}</span>.</p>
              </div>
            ) : error ? (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
                {typeof attemptsRemaining === "number" && attemptsRemaining > 0 && (
                  <span className="block text-xs mt-1 opacity-80">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining before your account is locked for 6 hours.
                  </span>
                )}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && !isForgot && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground font-medium">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="pl-10 h-12 bg-muted/50 border border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 h-12 bg-muted/50 border border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20" required />
                    </div>
                  </div>
                </div>
              )}

              {(isSignIn || isForgot) && !(isForgot && false) && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                  {isForgot && (
                    <p className="text-xs text-muted-foreground">
                      Enter the email you registered with. We'll send you a secure link to set a new password.
                    </p>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 h-12 bg-muted/50 border border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20" required disabled={isForgot && resetEmailSent} />
                  </div>
                  {isForgot && resetEmailSent && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Email sent. Check your inbox (and spam folder) for the reset link.
                    </p>
                  )}
                </div>
              )}

              {!isForgot && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                    {isSignIn && (
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); setError(""); resetOtpState(); setResetEmailSent(false); setNewPassword(""); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10 h-12 bg-muted/50 border border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20" required />
                    <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mode === "signup" && <PasswordStrength password={password} />}
                </div>
              )}

              {/* Phone OTP Section - Sign Up AND Forgot Password */}
              {mode === "signup" && !isForgot && (
                <div className="space-y-3 animate-fade-in">
                  <Label className="text-foreground font-medium">
                    {isForgot ? "Registered Phone Number" : "Phone Number"}
                  </Label>
                  {isForgot && (
                    <p className="text-xs text-muted-foreground -mt-1">
                      Enter the phone number you signed up with. We'll send a 6-digit code to verify it's you.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="2547XXXXXXXX"
                        className="pl-10 h-12 bg-muted/50 border border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20"
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
                          className="h-12 bg-muted/50 border border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 text-center tracking-widest text-lg"
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

              {/* Password reset uses a secure email link; no new password field on this page */}

              {mode === "signup" && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-foreground font-medium">I am a</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["customer", "worker", "supplier"] as UserRole[]).map((r) => (
                      <button key={r} type="button" onClick={() => setRole(r)}
                        className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all duration-200 ${
                          role === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {r === "worker" ? "Fundi" : r === "supplier" ? "Supplier" : "Client"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5 animate-fade-in">
                  <input
                    id="agree"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="agree" className="text-xs text-foreground leading-relaxed cursor-pointer">
                    I have read and agree to the{" "}
                    <a href="/legal/fundiplug-terms-of-use.pdf" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
                      Terms of Use
                    </a>{" "}
                    and consent to the{" "}
                    <a href="/legal/fundiplug-privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
                      Privacy Policy
                    </a>
                    .
                  </label>
                </div>
              )}

              <div className="flex items-stretch gap-2">
                <Button
                  type="submit"
                  disabled={loading || resetting || signupDisabled || resetDisabled || (mode === "signup" && !agreedToTerms) || (isSignIn && !!lockedUntil && lockMsLeft > 0)}
                  className="flex-1 h-12 text-base font-semibold rounded-lg active:scale-[0.98] transition-transform"
                >
                  {isForgot
                    ? (resetting ? "Sending..." : resetEmailSent ? "Email sent ✓" : "Send reset link")
                    : loading
                      ? "Please wait..."
                      : isSignIn
                        ? "Sign In"
                        : "Create Account"}
                </Button>
                {isSignIn && (
                  <>
                    <AuthVoiceButton compact onCompactClick={() => setShowVoiceRow((v) => !v)} />
                    <AuthFingerprintButton />
                  </>
                )}
              </div>

              {mode === "signup" && !agreedToTerms && (
                <p className="text-xs text-muted-foreground text-center">Agree to the Terms and Privacy Policy to continue</p>
              )}
              {signupDisabled && (
                <p className="text-xs text-muted-foreground text-center">Verify your phone number to create an account</p>
              )}
              {isForgot && !resetEmailSent && (
                <p className="text-xs text-muted-foreground text-center">We'll email you a secure link to set a new password.</p>
              )}
            </form>

            <div className="mt-6 text-center space-y-1">
              <a href="http://fundiplug.ke/" className="text-xs text-primary hover:underline block">← Go to Home</a>
              <p className="text-xs text-muted-foreground"><a href="https://www.digimatt.co.ke" target="_blank" rel="noopener noreferrer">© Powered by Digimatt Solutions</a></p>
              <div className="flex items-center justify-center gap-3 text-xs">
                <a href="/legal/fundiplug-terms-of-use.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Use</a>
                <span className="text-muted-foreground">·</span>
                <a href="/legal/fundiplug-privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
