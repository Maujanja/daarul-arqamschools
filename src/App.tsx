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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
            <Route path="/teachers" element={<StudentsPage />} />
            <Route path="/subjects" element={<DashboardPage />} />
            <Route path="/users" element={<DashboardPage />} />
            <Route path="/settings" element={<DashboardPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
