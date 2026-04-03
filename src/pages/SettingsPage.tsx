import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Palette, Sun, Moon, Monitor, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureData } from '@/hooks/useSecureData';
import { toast } from 'sonner';

type Theme = 'light' | 'dark' | 'system';

export default function SettingsPage() {
  const { user } = useAuth();
  const { update } = useSecureData();
  const [theme, setTheme] = useState<Theme>('system');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    const root = document.documentElement;
    
    if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
    
    toast.success(`Theme changed to ${newTheme}`);
  };

  const resetPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (!user || !isAdmin) {
      toast.error('Only the admin can change the admin password here.');
      return;
    }

    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!current || !next || !confirm) {
      toast.error('Fill in all password fields.');
      return;
    }

    if (next.length < 4) {
      toast.error('New password must be at least 4 characters.');
      return;
    }

    if (next !== confirm) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setIsSavingPassword(true);

    try {
      const result = await update<any[]>('admin_credentials', {
        password_hash: next,
      }, {
        id: user.id,
        password_hash: current,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update password');
      }

      if (!Array.isArray(result.data) || result.data.length === 0) {
        toast.error('Current password is incorrect.');
        return;
      }

      resetPasswordFields();
      toast.success('Admin password updated successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast.error(message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveChanges = async () => {
    if (currentPassword || newPassword || confirmPassword) {
      await handleChangePassword();
      return;
    }

    toast.success('Theme changes are applied automatically.');
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage system settings</p>
        </div>

        {/* Theme Settings - Admin Only */}
        {isAdmin && (
          <div className="card-elevated p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-lg text-card-foreground">Theme Settings</h2>
                <p className="text-sm text-muted-foreground">Customize the system appearance</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => applyTheme('light')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                  theme === 'light' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Sun className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-card-foreground">Light</p>
                  <p className="text-xs text-muted-foreground">Bright and clean</p>
                </div>
              </button>

              <button
                onClick={() => applyTheme('dark')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                  theme === 'dark' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
                  <Moon className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-card-foreground">Dark</p>
                  <p className="text-xs text-muted-foreground">Easy on the eyes</p>
                </div>
              </button>

              <button
                onClick={() => applyTheme('system')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                  theme === 'system' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-card-foreground">System</p>
                  <p className="text-xs text-muted-foreground">Match device settings</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* General Settings */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-card-foreground">General Settings</h2>
              <p className="text-sm text-muted-foreground">Basic school information</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school_name">School Name</Label>
              <Input id="school_name" defaultValue="EduManage Academy" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year">Academic Year</Label>
              <Input id="academic_year" defaultValue="2024/2025" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_term">Current Series</Label>
              <Input id="current_term" defaultValue="Series 1" className="input-enhanced" />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-card-foreground">Notifications</h2>
              <p className="text-sm text-muted-foreground">Manage notification settings</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">New Marks Notifications</p>
                <p className="text-sm text-muted-foreground">Get notified when marks are entered</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Feedback Notifications</p>
                <p className="text-sm text-muted-foreground">Get notified when new feedback arrives</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-card-foreground">Security</h2>
              <p className="text-sm text-muted-foreground">Security settings</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                className="input-enhanced"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                className="input-enhanced"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                className="input-enhanced"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={handleChangePassword} disabled={isSavingPassword}>
              {isSavingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Change Password
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="btn-gradient" onClick={handleSaveChanges} disabled={isSavingPassword}>
            {isSavingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
