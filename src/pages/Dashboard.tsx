import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import WorkerDashboard from "@/components/dashboards/WorkerDashboard";
import CustomerDashboard from "@/components/dashboards/CustomerDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "worker") return <WorkerDashboard />;
  return <CustomerDashboard />;
}
