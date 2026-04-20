import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Auth from "@/pages/Auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import ReportsPage from "@/pages/ReportsPage";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import UserManagementPage from "@/pages/UserManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import VerificationPage from "@/pages/VerificationPage";
import WorkerProfilePage from "@/pages/WorkerProfilePage";
import FundiOnboardingPage from "@/pages/FundiOnboardingPage";
import WorkerMyJobsPage from "@/pages/WorkerMyJobsPage";
import WorkerEarningsPage from "@/pages/WorkerEarningsPage";
import WorkerReviewsPage from "@/pages/WorkerReviewsPage";
import PublicReviewsPage from "@/pages/PublicReviewsPage";
import CustomerPostJobPage from "@/pages/CustomerPostJobPage";
import CustomerBookingsPage from "@/pages/CustomerBookingsPage";
import FindWorkersPage from "@/pages/FindWorkersPage";
import PaymentsPage from "@/pages/PaymentsPage";
import AdminJobsPage from "@/pages/AdminJobsPage";
import AdminCategoriesPage from "@/pages/AdminCategoriesPage";
import AdminDisbursementsPage from "@/pages/AdminDisbursementsPage";
import CommunityPage from "@/pages/CommunityPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reviews/:workerId" element={<PublicReviewsPage />} />
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
                <Route path="community" element={<CommunityPage />} />
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
