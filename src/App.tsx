import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MarksEntryPage from "./pages/MarksEntryPage";
import ReportsPage from "./pages/ReportsPage";
import StudentsPage from "./pages/StudentsPage";
import FeedbackPage from "./pages/FeedbackPage";
import TeachersPage from "./pages/TeachersPage";
import SubjectsPage from "./pages/SubjectsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import MyClassStudentsPage from "./pages/MyClassStudentsPage";
import AcademicYearsPage from "./pages/AcademicYearsPage";
import UnlockRequestsPage from "./pages/UnlockRequestsPage";
import NotFound from "./pages/NotFound";
import InstallPWA from "./components/InstallPWA";
import EnableNotifications from "./components/EnableNotifications";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPWA />
        <EnableNotifications />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/marks-entry" element={<MarksEntryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/records" element={<ReportsPage />} />
            <Route path="/teachers" element={<TeachersPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/my-class-students" element={<MyClassStudentsPage />} />
            <Route path="/academic-years" element={<AcademicYearsPage />} />
            <Route path="/unlock-requests" element={<UnlockRequestsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

