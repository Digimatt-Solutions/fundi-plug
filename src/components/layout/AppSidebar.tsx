import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, MapPin, Star, Briefcase, Search,
  BarChart3, Activity, Settings, ChevronLeft, Shield, CreditCard, UserCog, ArrowDownCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/logo.png";

const adminNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { title: "Verification", url: "/dashboard/verification", icon: Shield, key: "verification" },
  { title: "Jobs", url: "/dashboard/jobs", icon: Briefcase, key: "jobs" },
  { title: "Categories", url: "/dashboard/categories", icon: ClipboardList, key: "categories" },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard, key: "payments" },
  { title: "Disbursements", url: "/dashboard/disbursements", icon: ArrowDownCircle, key: "disbursements" },
  { title: "Community", url: "/dashboard/community", icon: Sparkles, key: "community" },
  { title: "Reports", url: "/dashboard/reports", icon: BarChart3, key: "reports" },
  { title: "Activity Logs", url: "/dashboard/activity", icon: Activity, key: "activity" },
  { title: "User Management", url: "/dashboard/user-management", icon: UserCog, key: "user-management" },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, key: "settings" },
];

const workerNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { title: "My Jobs", url: "/dashboard/my-jobs", icon: Briefcase, key: "my-jobs" },
  { title: "Profile", url: "/dashboard/profile", icon: UserCog, key: "profile" },
  { title: "Earnings", url: "/dashboard/earnings", icon: CreditCard, key: "earnings" },
  { title: "Reviews", url: "/dashboard/reviews", icon: Star, key: "reviews" },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard, key: "payments" },
  { title: "Community", url: "/dashboard/community", icon: Sparkles, key: "community" },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, key: "settings" },
];

const customerNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { title: "Post a Job", url: "/dashboard/post-job", icon: Briefcase, key: "post-job" },
  { title: "Find Fundis", url: "/dashboard/find-workers", icon: Search, key: "find-workers" },
  { title: "My Bookings", url: "/dashboard/bookings", icon: CalendarDays, key: "bookings" },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard, key: "payments" },
  { title: "Community", url: "/dashboard/community", icon: Sparkles, key: "community" },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, key: "settings" },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();
  const [disabledModules, setDisabledModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || user.role === "admin") return;
    const role = user.role === "worker" ? "worker" : "customer";
    supabase.from("module_settings").select("module_key, enabled").eq("role", role).then(({ data }) => {
      const disabled = new Set<string>();
      (data || []).forEach((m: any) => { if (!m.enabled) disabled.add(m.module_key); });
      setDisabledModules(disabled);
    });
  }, [user]);

  const allNav = user?.role === "admin" ? adminNav : user?.role === "worker" ? workerNav : customerNav;
  const navItems = user?.role === "admin" ? allNav : allNav.filter(item => !disabledModules.has(item.key));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <img src={logo} alt="FundiPlug" className="w-full h-full object-cover" />
        </div>
        {!collapsed && <span className="font-bold text-primary text-lg">FundiPlug</span>}
      </div>
      <SidebarContent className="scrollbar-thin py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {navItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className={`h-10 ${active ? "[&]:text-primary [&]:bg-primary/10" : ""}`}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={`rounded-lg border transition-all duration-150 text-[13px] font-medium ${
                          active
                            ? "!text-primary bg-primary/10 border-primary/40 shadow-sm"
                            : "text-sidebar-foreground border-sidebar-border hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                        }`}
                        activeClassName="!text-primary bg-primary/10 border-primary/40"
                      >
                        <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : ""}`} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <button onClick={toggleSidebar} className="flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground hover:text-primary transition-colors">
          <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
