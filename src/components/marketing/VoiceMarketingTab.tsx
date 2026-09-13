import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { normalizeTzPhone, splitPhoneBlob } from '@/utils/phoneNormalize';
import {
  Loader2,
  PhoneCall,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  Trash2,
  Users,
  Mic,
  Square,
  Type,
  Clock,
} from 'lucide-react';

interface VoiceRecipient {
  id: string;
  name: string | null;
  phone: string;
  status: string;
  delivery_status: string | null;
  duration_seconds: number | null;
  error: string | null;
}

interface VoiceCampaign {
  id: string;
  created_at: string;
  created_by: string | null;
  created_by_role: string | null;
  title: string | null;
  source: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  seconds_used: number;
  balance_after: number | null;
}

function fmtSeconds(total: number | null) {
  if (total === null || Number.isNaN(total)) return '—';
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function VoiceMarketingTab() {
  const { user } = useAuth();
  const role = user?.role || '';

  const [manualText, setManualText] = useState('');
  const [fileRecipients, setFileRecipients] = useState<{ phone: string; name: string | null }[]>([]);
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [sending, setSending] = useState(false);

  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string>('audio/mpeg');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSeconds, setAudioSeconds] = useState<number>(0);
  const [audioLabel, setAudioLabel] = useState<string>('');

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [seconds, setSeconds] = useState<number | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<VoiceRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const call = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('voice-campaign', {
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
      setSeconds(Number(d.seconds || 0));
      setConfigured(Boolean(d.configured));
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
    loadBalance();
    loadCampaigns();
  }, [loadBalance, loadCampaigns]);

  const manualList = useMemo(
    () => splitPhoneBlob(manualText).map((s) => normalizeTzPhone(s) || s),
    [manualText]
  );

  const allRecipients = useMemo(() => {
    const map = new Map<string, { phone: string; name: string | null }>();
    for (const r of fileRecipients) {
      const norm = normalizeTzPhone(r.phone) || r.phone.trim();
      if (!map.has(norm)) map.set(norm, { phone: norm, name: r.name });
    }
    for (const p of manualList) if (!map.has(p)) map.set(p, { phone: p, name: null });
    return Array.from(map.values());
  }, [fileRecipients, manualList]);

  const validCount = allRecipients.filter((r) => normalizeTzPhone(r.phone)).length;
  const invalidCount = allRecipients.length - validCount;

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows: any[][] = [];
      for (const sheetName of wb.SheetNames) {
        const json = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], {
          header: 1,
          blankrows: false,
        });
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
          if (!phone && normalizeTzPhone(s)) phone = s;
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

  const readAudio = (blob: Blob, label: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setAudioBase64(result.includes(',') ? result.split(',')[1] : result);
      setAudioMime(blob.type || 'audio/mpeg');
      setAudioLabel(label);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      const probe = new Audio(url);
      probe.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(probe.duration)) setAudioSeconds(Math.ceil(probe.duration));
      });
    };
    reader.readAsDataURL(blob);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        readAudio(blob, 'Sauti iliyorekodiwa');
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error('Imeshindikana kufungua maikrofoni. Ruhusu matumizi ya maikrofoni.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const clearAudio = () => {
    setAudioBase64(null);
    setAudioUrl(null);
    setAudioLabel('');
    setAudioSeconds(0);
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

  const handleSend = async () => {
    if (!audioBase64) {
      toast.error('Pakia au rekodi sauti kwanza');
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
        title: title.trim() || null,
        source: audioLabel === 'Sauti iliyorekodiwa' ? 'record' : 'upload',
        audioBase64,
        audioMime,
        audioSeconds,
        recipients: allRecipients,
      });
      toast.success(`Simu zilizotumwa: ${d.sent} | Zilizofeli: ${d.failed}`);
      setSeconds(Number(d.seconds || 0));
      setTitle('');
      setManualText('');
      setFileRecipients([]);
      setFileName('');
      clearAudio();
      await loadCampaigns();
      setOpenCampaign(d.campaign_id);
      await loadRecipients(d.campaign_id);
    } catch (e: any) {
      toast.error(e.message);
      await loadCampaigns();
    } finally {
      setSending(false);
    }
  };

  const toggleCampaign = async (id: string) => {
    if (openCampaign === id) {
      setOpenCampaign(null);
      setRecipients([]);
      return;
    }
    setOpenCampaign(id);
    await loadRecipients(id);
  };

  const refreshStatus = async (id: string) => {
    setRefreshingStatus(true);
    try {
      const d = await call({ action: 'refresh_status', campaignId: id });
      toast.success(`Zimeangaliwa: ${d.checked}, zimesasishwa: ${d.updated}`);
      await loadRecipients(id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefreshingStatus(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PhoneCall className="w-5 h-5" /> Voice Marketing
          </h2>
          <p className="text-sm text-muted-foreground">
            Tuma ujumbe wa sauti kwa namba nyingi — pakia sauti au rekodi moja kwa moja.
          </p>
        </div>
        <Card className="p-3 flex items-center gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Salio la voice</p>
            <p className="text-xl font-bold flex items-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" /> {fmtSeconds(seconds)}
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

      {!configured && (
        <Card className="p-3 border-amber-500/40">
          <p className="text-sm">
            Huduma ya voice (Briq) haijaunganishwa bado. Unaweza kutayarisha namba na sauti, ila simu
            hazitatoka hadi API key ya Briq iwekwe.
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Jina la kampeni (si lazima)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mfano: Taarifa ya sauti kwa wazazi"
            />
          </div>
          <div className="space-y-2">
            <Label>Pakia faili la Excel / CSV la namba</Label>
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
          <Label>Namba kwa mkono (paste au andika — zitajitenganisha zenyewe)</Label>
          <Textarea
            rows={3}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="0718999777, 750424704, 255755123456"
          />
        </div>

        <div className="space-y-3">
          <Label>Ujumbe wa sauti</Label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Pakia faili la sauti (mp3, wav, ogg)</p>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readAudio(f, f.name);
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Au rekodi sauti hapa</p>
              {recording ? (
                <Button variant="destructive" onClick={stopRecording} className="w-full">
                  <Square className="w-4 h-4 mr-1" /> Simamisha kurekodi
                </Button>
              ) : (
                <Button variant="outline" onClick={startRecording} className="w-full">
                  <Mic className="w-4 h-4 mr-1" /> Anza kurekodi
                </Button>
              )}
            </div>
          </div>

          {audioUrl && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <audio controls src={audioUrl} className="w-full sm:w-auto" />
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{audioLabel}</Badge>
                {audioSeconds > 0 && <Badge variant="secondary">{audioSeconds}s</Badge>}
                <Button size="sm" variant="ghost" onClick={clearAudio}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3">
            <Type className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Kuandika ujumbe na mfumo ubadilishe kuwa sauti (TTS) —{' '}
              <span className="font-medium">inakuja hivi karibuni</span>
            </p>
          </div>
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
          <Button onClick={handleSend} disabled={sending || validCount === 0 || !audioBase64}>
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" /> Inatuma...
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4 mr-1" /> Tuma sauti ({validCount})
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Historia ya voice campaigns</h3>
          <Button size="sm" variant="outline" onClick={loadCampaigns} disabled={loadingCampaigns}>
            {loadingCampaigns ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {campaigns.length === 0 && !loadingCampaigns && (
          <p className="text-sm text-muted-foreground">Hakuna kampeni ya sauti bado.</p>
        )}

        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="border border-border rounded-lg p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.title || 'Voice campaign'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString('en-GB')} •{' '}
                    {c.source === 'record' ? 'Recorded' : 'Uploaded'} •{' '}
                    {c.created_by || c.created_by_role}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Sent {c.sent_count}</Badge>
                  <Badge variant="destructive">Failed {c.failed_count}</Badge>
                  <Badge variant="secondary">Sekunde {c.seconds_used}</Badge>
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
                      onClick={() => refreshStatus(c.id)}
                      disabled={refreshingStatus}
                    >
                      {refreshingStatus ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-1" />
                      )}
                      Angalia hali
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
                            <th className="py-1 pr-3">Sekunde</th>
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
                              <td className="py-1 pr-3">{r.duration_seconds ?? '—'}</td>
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
  );
}
