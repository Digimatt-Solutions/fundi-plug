import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { supabase } from "@/integrations/supabase/client";
import Auth from "@/pages/Auth";
import SetupAdminPage from "@/pages/SetupAdminPage";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import ReportsPage from "@/pages/ReportsPage";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import UserManagementPage from "@/pages/UserManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import VerificationPage from "@/pages/VerificationPage";
import WorkerProfilePage from "@/pages/WorkerProfilePage";
import FundiOnboardingPage from "@/pages/FundiOnboardingPage";
import AccountProfilePage from "@/pages/AccountProfilePage";
import WorkerMyJobsPage from "@/pages/WorkerMyJobsPage";
import WorkerEarningsPage from "@/pages/WorkerEarningsPage";
import WorkerReviewsPage from "@/pages/WorkerReviewsPage";
import PublicReviewsPage from "@/pages/PublicReviewsPage";
import VerifyFundiPage from "@/pages/VerifyFundiPage";
import CustomerPostJobPage from "@/pages/CustomerPostJobPage";
import CustomerBookingsPage from "@/pages/CustomerBookingsPage";
import FindWorkersPage from "@/pages/FindWorkersPage";
import PaymentsPage from "@/pages/PaymentsPage";
import AdminJobsPage from "@/pages/AdminJobsPage";
import AdminCategoriesPage from "@/pages/AdminCategoriesPage";
import AdminDisbursementsPage from "@/pages/AdminDisbursementsPage";
import CommunityPage from "@/pages/CommunityPage";
import ChatPage from "@/pages/ChatPage";
import NotFound from "@/pages/NotFound";
import VisitTracker from "@/components/VisitTracker";

const queryClient = new QueryClient();

const SetupGate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (cancelled) return;
      if (!error && data === false && location.pathname !== "/setup-admin") {
        navigate("/setup-admin", { replace: true });
      }
      setChecked(true);
    })();
    return () => { cancelled = true; };
  }, [location.pathname, navigate]);

  return null;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <NotificationProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SetupGate />
            <VisitTracker />
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup-admin" element={<SetupAdminPage />} />
              <Route path="/reviews/:workerId" element={<PublicReviewsPage />} />
              <Route path="/verify-fundi/:workerId" element={<VerifyFundiPage />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                {/* Admin */}
                <Route path="verification" element={<VerificationPage />} />
                <Route path="jobs" element={<AdminJobsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="disbursements" element={<AdminDisbursementsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="activity" element={<ActivityLogsPage />} />
                <Route path="user-management" element={<UserManagementPage />} />
                {/* Worker */}
                <Route path="my-jobs" element={<WorkerMyJobsPage />} />
                <Route path="profile" element={<FundiOnboardingPage />} />
                <Route path="profile-legacy" element={<WorkerProfilePage />} />
                <Route path="earnings" element={<WorkerEarningsPage />} />
                <Route path="reviews" element={<WorkerReviewsPage />} />
                {/* Customer */}
                <Route path="post-job" element={<CustomerPostJobPage />} />
                <Route path="find-workers" element={<FindWorkersPage />} />
                <Route path="bookings" element={<CustomerBookingsPage />} />
                {/* Shared */}
                <Route path="account" element={<AccountProfilePage />} />
                <Route path="community" element={<CommunityPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
          </NotificationProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
