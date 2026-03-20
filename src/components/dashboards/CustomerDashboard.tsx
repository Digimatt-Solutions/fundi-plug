import { Search, MapPin, Star, Zap, CalendarDays, CreditCard, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const categories = [
  { name: "Electrician", icon: "⚡", count: 84 },
  { name: "Plumber", icon: "🔧", count: 62 },
  { name: "Carpenter", icon: "🪚", count: 45 },
  { name: "Painter", icon: "🎨", count: 38 },
  { name: "HVAC", icon: "❄️", count: 29 },
  { name: "Cleaner", icon: "🧹", count: 71 },
];

const nearbyWorkers = [
  { name: "James H.", skill: "Electrician", rating: 4.9, distance: "0.8 mi", available: true },
  { name: "Maria L.", skill: "Plumber", rating: 4.7, distance: "1.2 mi", available: true },
  { name: "David K.", skill: "Carpenter", rating: 4.8, distance: "2.1 mi", available: false },
  { name: "Ana R.", skill: "Painter", rating: 4.6, distance: "0.5 mi", available: true },
];

export default function CustomerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Find Skilled Workers</h1>
        <p className="text-muted-foreground text-sm">Book trusted professionals near you</p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl animate-fade-in">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="What service do you need?"
          className="pl-12 h-14 text-base bg-card border-border rounded-xl"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 max-w-lg animate-fade-in" style={{ animationDelay: "100ms" }}>
        <Button variant="outline" className="h-14 justify-start gap-3 bg-primary/5 border-primary/20 hover:bg-primary/10 text-foreground">
          <Zap className="w-5 h-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium">Instant Service</p>
            <p className="text-xs text-muted-foreground">Request now</p>
          </div>
        </Button>
        <Button variant="outline" className="h-14 justify-start gap-3 bg-card border-border hover:bg-muted text-foreground">
          <CalendarDays className="w-5 h-5 text-chart-3" />
          <div className="text-left">
            <p className="text-sm font-medium">Schedule</p>
            <p className="text-xs text-muted-foreground">Book ahead</p>
          </div>
        </Button>
      </div>

      {/* Categories */}
      <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
        <h2 className="text-lg font-semibold text-foreground mb-3">Service Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.name}
              className="stat-card flex flex-col items-center gap-2 py-5 hover:border-primary/40 cursor-pointer transition-colors active:scale-[0.97]"
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-medium text-foreground">{cat.name}</span>
              <span className="text-xs text-muted-foreground">{cat.count} available</span>
            </button>
          ))}
        </div>
      </div>

      {/* Nearby Workers */}
      <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <h2 className="text-lg font-semibold text-foreground mb-3">Nearby Workers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nearbyWorkers.map((worker) => (
            <div key={worker.name} className="stat-card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {worker.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{worker.name}</p>
                  <p className="text-xs text-muted-foreground">{worker.skill}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-chart-4">
                  <Star className="w-3 h-3 fill-current" /> {worker.rating}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-3 h-3" /> {worker.distance}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${worker.available ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                  {worker.available ? "Online" : "Offline"}
                </span>
              </div>
              <Button size="sm" className="w-full active:scale-[0.97] transition-transform">
                Hire Now
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: "400ms" }}>
        {[
          { label: "My Bookings", value: "12", icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Spent", value: "$1,840", icon: CreditCard, color: "text-chart-2", bg: "bg-chart-2/10" },
          { label: "Avg. Rating Given", value: "4.7", icon: Star, color: "text-chart-4", bg: "bg-chart-4/10" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{s.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
