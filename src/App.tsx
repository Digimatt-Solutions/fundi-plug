import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import ReportsPage from "@/pages/ReportsPage";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import UserManagementPage from "@/pages/UserManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import VerificationPage from "@/pages/VerificationPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="workers" element={<PlaceholderPage title="Workers Management" />} />
              <Route path="customers" element={<PlaceholderPage title="Customer Management" />} />
              <Route path="verification" element={<VerificationPage />} />
              <Route path="jobs" element={<PlaceholderPage title="Jobs Management" />} />
              <Route path="categories" element={<PlaceholderPage title="Service Categories" />} />
              <Route path="payments" element={<PlaceholderPage title="Payments" />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="activity" element={<ActivityLogsPage />} />
              <Route path="user-management" element={<UserManagementPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="my-jobs" element={<PlaceholderPage title="My Jobs" />} />
              <Route path="availability" element={<PlaceholderPage title="Availability" />} />
              <Route path="earnings" element={<PlaceholderPage title="Earnings" />} />
              <Route path="reviews" element={<PlaceholderPage title="Reviews" />} />
              <Route path="messages" element={<PlaceholderPage title="Messages" />} />
              <Route path="profile" element={<PlaceholderPage title="Profile" />} />
              <Route path="find-workers" element={<PlaceholderPage title="Find Workers" />} />
              <Route path="bookings" element={<PlaceholderPage title="My Bookings" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
