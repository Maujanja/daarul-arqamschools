import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import BulkSmsTab from '@/components/marketing/BulkSmsTab';
import VoiceMarketingTab from '@/components/marketing/VoiceMarketingTab';
import WhatsAppBroadcastTab from '@/components/marketing/WhatsAppBroadcastTab';
import { MessageSquare, PhoneCall, MessageCircle, Wallet, Megaphone } from 'lucide-react';

const ALLOWED = ['admin', 'accountant', 'head_nursery', 'head_primary', 'head_secondary'];

export default function MarketingPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const [tab, setTab] = useState('sms');

  if (!ALLOWED.includes(role)) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6" /> Marketing
          </h1>
          <p className="text-sm text-muted-foreground">
            Bulk SMS, voice marketing na huduma zingine za kufikia wazazi na wateja.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="sms" className="gap-1">
              <MessageSquare className="w-4 h-4" /> Bulk SMS
            </TabsTrigger>
            <TabsTrigger value="voice" className="gap-1">
              <PhoneCall className="w-4 h-4" /> Voice Marketing
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="topup" className="gap-1">
              <Wallet className="w-4 h-4" /> Salio la Voice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sms">
            <BulkSmsTab />
          </TabsContent>

          <TabsContent value="voice">
            <VoiceMarketingTab />
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card className="p-6 space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <h2 className="text-lg font-semibold">WhatsApp Marketing</h2>
                <Badge variant="secondary">Inakuja hivi karibuni</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Kipengele hiki kitawezesha kutuma ujumbe wa WhatsApp kwa wingi. Kitafunguliwa baada ya
                huduma ya WhatsApp Business kuunganishwa.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="topup">
            <Card className="p-6 space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Kununua salio la voice</h2>
                <Badge variant="secondary">Inakuja hivi karibuni</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Malipo ya mtandao (mobile money) yatawezeshwa mara link ya malipo ya Mongike
                itakapounganishwa. Salio la voice linahesabiwa kwa dakika/sekunde za simu na
                linaonekana kwenye ukurasa wa Voice Marketing.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
