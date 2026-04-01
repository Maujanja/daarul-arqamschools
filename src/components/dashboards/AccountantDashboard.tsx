import { SecretaryDashboard } from './SecretaryDashboard';

interface AccountantDashboardProps {
  isAdminMode?: boolean;
}

export function AccountantDashboard({ isAdminMode = false }: AccountantDashboardProps) {
  // The SecretaryDashboard already has all fee management functionality
  // We reuse it for the accountant role
  return <SecretaryDashboard isAdminMode={isAdminMode} />;
}
