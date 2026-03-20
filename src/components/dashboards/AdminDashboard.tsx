import { Users, Briefcase, CreditCard, Wrench, TrendingUp, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const stats = [
  { label: "Total Users", value: "1,247", icon: Users, color: "text-chart-3", bg: "bg-chart-3/10" },
  { label: "Active Workers", value: "384", icon: Wrench, color: "text-chart-2", bg: "bg-chart-2/10" },
  { label: "Jobs Completed", value: "2,891", icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
  { label: "Revenue", value: "$48,320", icon: CreditCard, color: "text-chart-4", bg: "bg-chart-4/10" },
  { label: "Pending Verifications", value: "12", icon: TrendingUp, color: "text-chart-5", bg: "bg-chart-5/10" },
  { label: "Active Jobs", value: "67", icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
];

const weeklyData = [
  { day: "Mon", jobs: 32 }, { day: "Tue", jobs: 28 },
  { day: "Wed", jobs: 45 }, { day: "Thu", jobs: 38 },
  { day: "Fri", jobs: 52 }, { day: "Sat", jobs: 41 },
  { day: "Sun", jobs: 29 },
];

const categoryData = [
  { name: "Electrician", value: 35 },
  { name: "Plumber", value: 25 },
  { name: "Carpenter", value: 20 },
  { name: "Painter", value: 12 },
  { name: "Other", value: 8 },
];

const COLORS = [
  "hsl(22, 93%, 49%)",
  "hsl(173, 58%, 39%)",
  "hsl(197, 71%, 53%)",
  "hsl(43, 96%, 56%)",
  "hsl(280, 65%, 60%)",
];

const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your skilled workers platform</p>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">{today}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card animate-fade-in" style={{ animationDelay: "500ms" }}>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Weekly Job Activity</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis dataKey="day" stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222, 28%, 12%)",
                  border: "1px solid hsl(222, 20%, 20%)",
                  borderRadius: "8px",
                  color: "hsl(220, 14%, 90%)",
                }}
              />
              <Area type="monotone" dataKey="jobs" stroke="hsl(22, 93%, 49%)" fill="url(#jobGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: "600ms" }}>
          <div className="flex items-center gap-2 mb-6">
            <Wrench className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Service Categories</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="45%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222, 28%, 12%)",
                  border: "1px solid hsl(222, 20%, 20%)",
                  borderRadius: "8px",
                  color: "hsl(220, 14%, 90%)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
