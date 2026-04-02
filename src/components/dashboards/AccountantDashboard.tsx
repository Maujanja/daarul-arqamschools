import { FeeDashboard } from './FeeDashboard';

interface AccountantDashboardProps {
  isAdminMode?: boolean;
}

export function AccountantDashboard({ isAdminMode = false }: AccountantDashboardProps) {
  return <FeeDashboard isAdminMode={isAdminMode} />;
}
