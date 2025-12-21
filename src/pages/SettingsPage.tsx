import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Palette } from 'lucide-react';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage system settings</p>
        </div>

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
              <Label htmlFor="current_term">Current Term</Label>
              <Input id="current_term" defaultValue="Term 1" className="input-enhanced" />
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
              <Input id="current_password" type="password" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input id="new_password" type="password" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input id="confirm_password" type="password" className="input-enhanced" />
            </div>
            <Button variant="outline">Change Password</Button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="btn-gradient">
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
