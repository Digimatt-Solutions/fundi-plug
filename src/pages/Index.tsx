import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import cover from "@/assets/fundiplug-cover.jpg";
import { Button } from "@/components/ui/button";
import { ShieldCheck, MapPin, Wallet, Star, Wrench, Zap, Hammer, Paintbrush, Truck, Sparkles } from "lucide-react";

const SERVICES = [
  { name: "Plumbers", icon: Wrench, desc: "Leak repairs, installations and emergency plumbing across Kenya." },
  { name: "Electricians", icon: Zap, desc: "Wiring, fault diagnosis, solar and certified electrical work." },
  { name: "Masons & Builders", icon: Hammer, desc: "Construction, renovation, tiling and finishing experts." },
  { name: "Painters", icon: Paintbrush, desc: "Interior, exterior and decorative painting professionals." },
  { name: "Movers", icon: Truck, desc: "House and office relocation with vetted teams." },
  { name: "Cleaners", icon: Sparkles, desc: "Deep cleaning, post-construction and routine cleaning." },
];

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "FundiPlug Kenya | Hire Verified Fundis, Plumbers, Electricians & Skilled Workers";
  }, []);

  // Authenticated users go straight to their dashboard
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2" aria-label="FundiPlug home">
            <img src={logo} alt="FundiPlug logo" className="w-9 h-9 rounded" />
            <span className="font-bold text-primary text-lg">FundiPlug</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get started</Button></Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 py-12 sm:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
              Hire Verified <span className="text-primary">Fundis</span> in Kenya - Instantly.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              FundiPlug connects you with trusted plumbers, electricians, masons, carpenters, painters, mechanics, cleaners and movers near you. Book skilled workers in minutes and pay safely with M-Pesa.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth"><Button size="lg">Find a Fundi</Button></Link>
              <Link to="/auth"><Button size="lg" variant="outline">Become a Fundi</Button></Link>
            </div>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> ID-verified fundis</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Workers near you</li>
              <li className="flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Pay with M-Pesa</li>
            </ul>
          </div>
          <div>
            <img src={cover} alt="Skilled fundis you can rely on across Kenya" className="w-full rounded-2xl border border-border shadow-lg" loading="eager" decoding="async" />
          </div>
        </section>

        {/* Services */}
        <section className="bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Popular services on FundiPlug</h2>
            <p className="text-muted-foreground mt-2">From small repairs to full construction projects - hire skilled workers across Nairobi, Mombasa, Kisumu, Nakuru, Eldoret and every county.</p>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SERVICES.map((s) => (
                <article key={s.name} className="rounded-xl border border-border bg-background p-5">
                  <s.icon className="w-6 h-6 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold mt-3">{s.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold">How FundiPlug works</h2>
          <ol className="mt-6 grid sm:grid-cols-3 gap-4">
            <li className="rounded-xl border border-border p-5">
              <span className="text-primary font-bold">Step 1</span>
              <h3 className="font-semibold mt-1">Post a job or Hire Now</h3>
              <p className="text-sm text-muted-foreground mt-1">Describe what you need or request an instant fundi nearby.</p>
            </li>
            <li className="rounded-xl border border-border p-5">
              <span className="text-primary font-bold">Step 2</span>
              <h3 className="font-semibold mt-1">Pick a verified fundi</h3>
              <p className="text-sm text-muted-foreground mt-1">Compare ratings, reviews and rates - all fundis are ID-verified.</p>
            </li>
            <li className="rounded-xl border border-border p-5">
              <span className="text-primary font-bold">Step 3</span>
              <h3 className="font-semibold mt-1">Pay safely with M-Pesa</h3>
              <p className="text-sm text-muted-foreground mt-1">Release payment after the job is done - protected end to end.</p>
            </li>
          </ol>
        </section>

        {/* Trust */}
        <section className="bg-muted/30 border-t border-border">
          <div className="max-w-6xl mx-auto px-4 py-12 text-center">
            <Star className="w-8 h-8 text-primary mx-auto" />
            <h2 className="text-2xl sm:text-3xl font-bold mt-2">Kenya's trusted fundi marketplace</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Thousands of clients use FundiPlug to find reliable skilled workers every week. Real reviews, transparent pricing, instant booking.</p>
            <div className="mt-6">
              <Link to="/auth"><Button size="lg">Get started free</Button></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          FundiPlug - © Digimatt Solutions 2026 - <a href="/auth" className="text-primary hover:underline">Sign in</a>
        </div>
      </footer>
    </div>
  );
}
