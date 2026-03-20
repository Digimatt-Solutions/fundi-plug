import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, Wrench, MapPin, Star, Briefcase, Search,
  BarChart3, Activity, Settings, ChevronLeft, Shield, CreditCard, MessageSquare, UserCog,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const adminNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Workers", url: "/dashboard/workers", icon: Wrench },
  { title: "Customers", url: "/dashboard/customers", icon: Users },
  { title: "Verification", url: "/dashboard/verification", icon: Shield },
  { title: "Jobs", url: "/dashboard/jobs", icon: Briefcase },
  { title: "Categories", url: "/dashboard/categories", icon: ClipboardList },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
  { title: "Activity Logs", url: "/dashboard/activity", icon: Activity },
  { title: "User Management", url: "/dashboard/user-management", icon: UserCog },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

const workerNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Jobs", url: "/dashboard/my-jobs", icon: Briefcase },
  { title: "Profile", url: "/dashboard/profile", icon: UserCog },
  { title: "Earnings", url: "/dashboard/earnings", icon: CreditCard },
  { title: "Reviews", url: "/dashboard/reviews", icon: Star },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

const customerNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Post a Job", url: "/dashboard/post-job", icon: Briefcase },
  { title: "Find Workers", url: "/dashboard/find-workers", icon: Search },
  { title: "My Bookings", url: "/dashboard/bookings", icon: CalendarDays },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const navItems = user?.role === "admin" ? adminNav : user?.role === "worker" ? workerNav : customerNav;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Wrench className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && <span className="font-bold text-sidebar-accent-foreground text-lg">SkillHub</span>}
      </div>
      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={`transition-colors duration-150 ${active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent"}`}
                        activeClassName="bg-primary text-primary-foreground"
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
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
        <button onClick={toggleSidebar} className="flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors">
          <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
