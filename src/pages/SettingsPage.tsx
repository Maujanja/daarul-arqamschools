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
          <h1 className="text-3xl font-display font-bold text-foreground">Mipangilio</h1>
          <p className="text-muted-foreground mt-1">Simamia mipangilio ya mfumo</p>
        </div>

        {/* General Settings */}
        <div className="card-elevated p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-card-foreground">Mipangilio ya Jumla</h2>
              <p className="text-sm text-muted-foreground">Taarifa za msingi za shule</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school_name">Jina la Shule</Label>
              <Input id="school_name" defaultValue="EduManage Academy" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year">Mwaka wa Masomo</Label>
              <Input id="academic_year" defaultValue="2024/2025" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_term">Muhula wa Sasa</Label>
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
              <h2 className="font-display font-semibold text-lg text-card-foreground">Arifa</h2>
              <p className="text-sm text-muted-foreground">Simamia mipangilio ya arifa</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Arifa za Barua Pepe</p>
                <p className="text-sm text-muted-foreground">Pata arifa kwa barua pepe</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Arifa za Alama Mpya</p>
                <p className="text-sm text-muted-foreground">Julikane alama zinapoingizwa</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Arifa za Maoni</p>
                <p className="text-sm text-muted-foreground">Julikane maoni mapya yanapofika</p>
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
              <h2 className="font-display font-semibold text-lg text-card-foreground">Usalama</h2>
              <p className="text-sm text-muted-foreground">Mipangilio ya usalama</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Nenosiri la Sasa</Label>
              <Input id="current_password" type="password" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">Nenosiri Jipya</Label>
              <Input id="new_password" type="password" className="input-enhanced" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Thibitisha Nenosiri</Label>
              <Input id="confirm_password" type="password" className="input-enhanced" />
            </div>
            <Button variant="outline">Badilisha Nenosiri</Button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="btn-gradient">
            Hifadhi Mabadiliko
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
