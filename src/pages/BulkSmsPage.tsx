import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Upload,
  CheckCircle2,
  XCircle,
  Trash2,
  Users,
} from 'lucide-react';

interface Recipient {
  id: string;
  name: string | null;
  phone: string;
  raw_phone: string | null;
  status: string;
  delivery_status: string | null;
  delivery_checked_at: string | null;
  error: string | null;
}

interface Campaign {
  id: string;
  created_at: string;
  created_by: string | null;
  created_by_role: string | null;
  title: string | null;
  message: string;
  source: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  balance_after: number | null;
}

const ALLOWED = ['admin', 'accountant', 'head_nursery', 'head_primary', 'head_secondary'];

function normalizePreview(raw: string): string | null {
  let p = raw.trim().replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0') && p.length === 10) p = '255' + p.slice(1);
  if ((p.startsWith('7') || p.startsWith('6')) && p.length === 9) p = '255' + p;
  return /^255\d{9}$/.test(p) ? p : null;
}

export default function BulkSmsPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const canView = ALLOWED.includes(role);

  const [manualText, setManualText] = useState('');
  const [fileRecipients, setFileRecipients] = useState<{ phone: string; name: string | null }[]>([]);
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [refreshingDelivery, setRefreshingDelivery] = useState(false);

  const call = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('bulk-sms', {
        body: { ...payload, userRole: role, userName: user?.name || null },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Request failed');
      return data;
    },
    [role, user]
  );

  const loadBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const d = await call({ action: 'balance' });
      setBalance(d.balance === null ? null : Number(d.balance));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingBalance(false);
    }
  }, [call]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const d = await call({ action: 'campaigns' });
      setCampaigns(d.campaigns || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [call]);

  useEffect(() => {
    if (!canView) return;
    loadBalance();
    loadCampaigns();
  }, [canView, loadBalance, loadCampaigns]);

  const manualList = useMemo(
    () =>
      manualText
        .split(/[\s,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [manualText]
  );

  const allRecipients = useMemo(() => {
    const map = new Map<string, { phone: string; name: string | null }>();
    for (const r of fileRecipients) map.set(r.phone.trim(), r);
    for (const p of manualList) if (!map.has(p)) map.set(p, { phone: p, name: null });
    return Array.from(map.values());
  }, [fileRecipients, manualList]);

  const validCount = allRecipients.filter((r) => normalizePreview(r.phone)).length;
  const invalidCount = allRecipients.length - validCount;

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows: any[][] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false });
        rows.push(...json);
      }
      const found: { phone: string; name: string | null }[] = [];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        let phone: string | null = null;
        let name: string | null = null;
        for (const cell of row) {
          if (cell === null || cell === undefined) continue;
          const s = String(cell).trim();
          if (!s) continue;
          if (!phone && normalizePreview(s)) phone = s;
          else if (!name && !/^\+?[\d\s\-()]+$/.test(s)) name = s;
        }
        if (phone) found.push({ phone, name });
      }
      if (found.length === 0) {
        toast.error('Hakuna namba za simu zilizopatikana kwenye faili hili.');
        return;
      }
      setFileRecipients(found);
      setFileName(file.name);
      toast.success(`Namba ${found.length} zimepakiwa kutoka ${file.name}`);
    } catch (e: any) {
      toast.error(e.message || 'Imeshindikana kusoma faili');
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Andika ujumbe kwanza');
      return;
    }
    if (validCount === 0) {
      toast.error('Hakuna namba sahihi ya kutuma');
      return;
    }
    setSending(true);
    try {
      const d = await call({
        action: 'send',
        message: message.trim(),
        title: title.trim() || null,
        source: fileRecipients.length > 0 ? 'excel' : 'manual',
        recipients: allRecipients,
      });
      toast.success(`SMS zimetumwa: ${d.sent} | Zilizofeli: ${d.failed}`);
      setBalance(d.balance === null ? null : Number(d.balance));
      setMessage('');
      setTitle('');
      setManualText('');
      setFileRecipients([]);
      setFileName('');
      await loadCampaigns();
      setOpenCampaign(d.campaign_id);
      await loadRecipients(d.campaign_id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const loadRecipients = useCallback(
    async (campaignId: string) => {
      setLoadingRecipients(true);
      try {
        const d = await call({ action: 'recipients', campaignId });
        setRecipients(d.recipients || []);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoadingRecipients(false);
      }
    },
    [call]
  );

  const toggleCampaign = async (id: string) => {
    if (openCampaign === id) {
      setOpenCampaign(null);
      setRecipients([]);
      return;
    }
    setOpenCampaign(id);
    await loadRecipients(id);
  };

  const refreshDelivery = async (id: string) => {
    setRefreshingDelivery(true);
    try {
      const d = await call({ action: 'refresh_delivery', campaignId: id });
      toast.success(`Delivery imeangaliwa: ${d.checked}, imesasishwa: ${d.updated}`);
      await loadRecipients(id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefreshingDelivery(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await call({ action: 'delete_campaign', campaignId: id });
      toast.success('Kampeni imefutwa');
      if (openCampaign === id) {
        setOpenCampaign(null);
        setRecipients([]);
      }
      await loadCampaigns();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!canView) return <Navigate to="/dashboard" replace />;

  const smsParts = Math.max(1, Math.ceil(message.length / 160));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" /> Bulk SMS
            </h1>
            <p className="text-sm text-muted-foreground">
              Tuma SMS kwa namba nyingi kwa mkono au kwa kupakia faili la Excel.
            </p>
          </div>
          <Card className="p-3 flex items-center gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Salio la Beem</p>
              <p className="text-xl font-bold">
                {balance === null ? '—' : balance}{' '}
                <span className="text-xs font-normal text-muted-foreground">credits</span>
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={loadBalance} disabled={loadingBalance}>
              {loadingBalance ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </Card>
        </div>

        <Card className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Jina la kampeni (si lazima)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mfano: Taarifa ya mkutano wa wazazi"
              />
            </div>
            <div className="space-y-2">
              <Label>Pakia faili la Excel / CSV</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {fileRecipients.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFileRecipients([]);
                      setFileName('');
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {fileName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="w-3 h-3" /> {fileName} — namba {fileRecipients.length}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Namba kwa mkono (tenganisha kwa comma, space au mstari mpya)</Label>
            <Textarea
              rows={3}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="0718999777, 0755123456"
            />
          </div>

          <div className="space-y-2">
            <Label>Ujumbe</Label>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Andika ujumbe wako hapa..."
            />
            <p className="text-xs text-muted-foreground">
              Herufi {message.length} — SMS {smsParts} kwa kila mpokeaji
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" /> Wapokeaji {allRecipients.length}
              </Badge>
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Sahihi {validCount}
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" /> Si sahihi {invalidCount}
                </Badge>
              )}
            </div>
            <Button onClick={handleSend} disabled={sending || validCount === 0}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" /> Inatuma...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" /> Tuma SMS ({validCount})
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Historia ya utumaji</h2>
            <Button size="sm" variant="outline" onClick={loadCampaigns} disabled={loadingCampaigns}>
              {loadingCampaigns ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>

          {campaigns.length === 0 && !loadingCampaigns && (
            <p className="text-sm text-muted-foreground">Hakuna SMS zilizotumwa bado.</p>
          )}

          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="border border-border rounded-lg p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.title || 'Bulk SMS'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString('en-GB')} •{' '}
                      {c.source === 'excel' ? 'Excel file' : 'Manual'} •{' '}
                      {c.created_by || c.created_by_role}
                    </p>
                    <p className="text-sm mt-1 line-clamp-2 break-words">{c.message}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Sent {c.sent_count}</Badge>
                    <Badge variant="destructive">Failed {c.failed_count}</Badge>
                    {c.balance_after !== null && (
                      <Badge variant="secondary">Salio {c.balance_after}</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => toggleCampaign(c.id)}>
                      {openCampaign === c.id ? 'Ficha' : 'Angalia'}
                    </Button>
                    {role === 'admin' && (
                      <Button size="sm" variant="ghost" onClick={() => deleteCampaign(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {openCampaign === c.id && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Wapokeaji</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refreshDelivery(c.id)}
                        disabled={refreshingDelivery}
                      >
                        {refreshingDelivery ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Angalia delivery
                      </Button>
                    </div>
                    {loadingRecipients ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Inapakia...
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-1 pr-3">Namba</th>
                              <th className="py-1 pr-3">Jina</th>
                              <th className="py-1 pr-3">Hali</th>
                              <th className="py-1 pr-3">Delivery</th>
                              <th className="py-1">Kosa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipients.map((r) => (
                              <tr key={r.id} className="border-t border-border/50">
                                <td className="py-1 pr-3 whitespace-nowrap">{r.phone}</td>
                                <td className="py-1 pr-3">{r.name || '—'}</td>
                                <td className="py-1 pr-3">
                                  {r.status === 'sent' ? (
                                    <span className="text-emerald-500">Sent</span>
                                  ) : (
                                    <span className="text-destructive">Failed</span>
                                  )}
                                </td>
                                <td className="py-1 pr-3">{r.delivery_status || '—'}</td>
                                <td className="py-1 text-xs text-muted-foreground break-all">
                                  {r.error || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
