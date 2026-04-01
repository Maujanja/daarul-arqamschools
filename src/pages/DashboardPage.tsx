import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboards/TeacherDashboard';
import { ParentDashboard } from '@/components/dashboards/ParentDashboard';
import { SecretaryDashboard } from '@/components/dashboards/SecretaryDashboard';
import { AccountantDashboard } from '@/components/dashboards/AccountantDashboard';
import { HeadOfSchoolDashboard } from '@/components/dashboards/HeadOfSchoolDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  const renderDashboard = () => {
    switch (user?.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'parent':
        return <ParentDashboard />;
      case 'secretary':
        return <SecretaryDashboard />;
      case 'accountant':
        return <AccountantDashboard />;
      case 'head_nursery':
      case 'head_primary':
      case 'head_secondary':
        return <HeadOfSchoolDashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
