import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@/assets/workers-hero.jpg";

const Auth = () => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignIn) {
        await login(email, password);
        navigate("/dashboard");
      } else {
        await signup(email, password, name, role);
        toast({
          title: "Account created",
          description: "Please check your email for verification, or sign in if auto-confirmed.",
        });
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={heroImage} alt="Skilled workers" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-3xl font-bold leading-tight mb-3" style={{ textWrap: "balance" }}>
            Connect with Skilled Professionals
          </h2>
          <p className="text-white/70 text-lg max-w-md">
            Find verified electricians, plumbers, carpenters and more — on demand or scheduled.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-card p-8 dark:bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              <Wrench className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">SkillHub</h1>
            <p className="text-muted-foreground text-sm mt-1">Skilled Workers Marketplace</p>
          </div>

          <div className="flex bg-muted rounded-lg p-1 mb-8">
            <button
              onClick={() => setIsSignIn(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                isSignIn ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignIn(false)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                !isSignIn ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

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
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold rounded-lg active:scale-[0.98] transition-transform">
              {loading ? "Please wait..." : isSignIn ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
