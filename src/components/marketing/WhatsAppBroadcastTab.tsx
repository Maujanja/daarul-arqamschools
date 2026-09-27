import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Bot, Download, ExternalLink, Loader2, MessageCircle, Send, Upload, User, Lock, Wallet, RefreshCw } from 'lucide-react';

type Recipient = { name: string; phone: string; generated: boolean };
type ChatMsg = { role: 'user' | 'ai'; text: string; count?: number };

const TEMPLATE_NOTE =
  "Enter each recipient's full name and phone number on a separate row. You can add up to 2000 recipients to an audience.";

export default function WhatsAppBroadcastTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'ai',
      text:
        'Nipe namba za simu (255…, 07…, au 7…) pamoja na majina kama unayo. Nitatengeneza Excel file ya WhatsApp broadcast tayari kwa kudownload. Namba isiyo na jina nitaitungia jina.',
    },
  ]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [buying, setBuying] = useState(false);

  const who = { userId: user?.id || '', userRole: user?.role || '', userName: user?.name || '' };

  const loadStatus = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.functions.invoke('wa-credits', {
      body: { action: 'status', userId: user.id, userRole: user.role, userName: user.name },
    });
    if (data?.success) {
      setCredits(data.balance);
      setPending(data.pending);
    }
  }, [user]);

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 20000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const buyCredits = async () => {
    const win = window.open('about:blank', '_blank');
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-credits', { body: { action: 'purchase', ...who } });
      if (error || !data?.success) throw new Error(data?.error || 'Imeshindikana');
      if (win) win.location.href = data.payUrl;
      else window.location.href = data.payUrl;
      toast({
        title: 'Ombi la malipo limetumwa',
        description: 'Kamilisha malipo ya TZS 50,000. Credit 10,000 zitaingia baada ya malipo kuthibitishwa.',
      });
      loadStatus();
    } catch (e) {
      win?.close();
      toast({ title: 'Hitilafu', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBuying(false);
    }
  };

  const locked = (credits ?? 0) <= 0;

  const buildAudience = async (rawText: string, displayText = rawText) => {
    const text = rawText.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: 'user', text: displayText }]);
    setPrompt('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-audience', {
        body: { prompt: text, userRole: user?.role || '', userId: user?.id || '' },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const details = ctx ? await ctx.json().catch(() => null) : null;
        loadStatus();
        throw new Error(details?.error || error.message);
      }
      if (!data?.success) throw new Error(data?.error || 'AI imeshindwa kujibu');

      const list: Recipient[] = data.recipients ?? [];
      setRecipients(list);
      if (typeof data.creditsLeft === 'number') setCredits(data.creditsLeft);
      setMessages((m) => [
        ...m,
        { role: 'ai', text: data.reply || `Nimepata namba ${list.length}.`, count: list.length },
      ]);
      if ((data.invalid ?? []).length) {
        toast({
          title: 'Namba zisizosahihi',
          description: `${data.invalid.length} namba hazikuwa sahihi na zimeachwa.`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: 'ai', text: `Samahani, hitilafu: ${msg}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9 }), 50);
    }
  };

  const ask = () => buildAudience(prompt);

  const uploadExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || loading) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error('Excel file haina taarifa.');

      const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
        header: 1,
        raw: true,
        defval: '',
      });
      const text = rows
        .map((row) =>
          row
            .map((cell) => {
              if (typeof cell === 'number' && Number.isFinite(cell)) return cell.toFixed(0);
              return String(cell ?? '').trim();
            })
            .filter(Boolean)
            .join(' | '),
        )
        .filter(Boolean)
        .join('\n');

      if (!text) throw new Error('Excel file haina taarifa.');
      await buildAudience(text, `Excel: ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Excel imeshindwa kusomwa.';
      setMessages((current) => [...current, { role: 'ai', text: `Samahani, hitilafu: ${message}` }]);
    }
  };

  const downloadExcel = () => {
    if (!recipients.length) return;
    const rows: (string | number)[][] = [
      [TEMPLATE_NOTE],
      [],
      ['Full name', 'Phone number'],
      ...recipients.map((r) => [r.name, r.phone]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 34 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audience');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `business_broadcast_audience_${stamp}.xlsx`);
  };

  const generatedCount = recipients.filter((r) => r.generated).length;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <div>
              <div className="font-semibold">
                Credit za WhatsApp: {credits === null ? '…' : credits.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                TZS 5 (credit 1) kwa kila namba. Kifurushi: credit 10,000 kwa TZS 50,000.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={loadStatus} aria-label="Sasisha salio">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={buyCredits} disabled={buying} className="gap-1">
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Nunua credit 10,000 (TZS 50,000)
            </Button>
          </div>
        </div>
        {pending > 0 && (
          <p className="text-sm text-muted-foreground">
            Malipo {pending} yanasubiri kuthibitishwa. Credit zitaingia yakishathibitishwa.
          </p>
        )}
      </Card>

      {locked ? (
        <Card className="p-6 text-center space-y-2">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">WhatsApp Broadcast imefungwa</h2>
          <p className="text-sm text-muted-foreground">
            Nunua credit ili kutengeneza Excel ya namba. Kila namba inakatwa credit 1 (TZS 5).
          </p>
        </Card>
      ) : (
      <Card className="p-4 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <h2 className="text-lg font-semibold">WhatsApp Broadcast — AI Audience Builder</h2>
          <Badge variant="secondary">Excel tayari kwa WhatsApp Business</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Andika maelekezo yako kwenye chat — mfano: “Tengeneza list ya hizi namba 0754123456,
          0789112233, 712334455 kwa wazazi wa Primary 3”. Excel itatengenezwa kwa muundo wa template
          ya business broadcast audience.
        </p>

        <ScrollArea className="h-72 rounded-md border p-3" ref={scrollRef as never}>
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'ai' && <Bot className="w-4 h-4 mt-1 shrink-0" />}
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-primary/15' : 'bg-muted'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'user' && <User className="w-4 h-4 mt-1 shrink-0" />}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> AI inatengeneza list…
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-col sm:flex-row gap-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="Weka namba na maelekezo yako hapa…"
            className="min-h-[72px]"
          />
          <Button onClick={ask} disabled={loading || !prompt.trim()} className="gap-1 sm:self-end">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Tuma
          </Button>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={uploadExcel}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            <Upload className="w-4 h-4" /> Upload Excel yenye namba
          </Button>
        </div>
      </Card>
      )}

      {recipients.length > 0 && (
        <Card className="p-4 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Audience ({recipients.length})</h3>
              {generatedCount > 0 && (
                <Badge variant="outline">{generatedCount} majina ya kubuni</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadExcel} className="gap-1">
                <Download className="w-4 h-4" /> Download Excel
              </Button>
              <Button variant="secondary" className="gap-1" asChild>
                <a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> Fungua WhatsApp Web
                </a>
              </Button>
            </div>
          </div>

          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 sticky top-0">
                <tr>
                  <th className="text-left p-2 w-10">#</th>
                  <th className="text-left p-2">Full name</th>
                  <th className="text-left p-2">Phone number</th>
                  <th className="text-left p-2 w-24">Chat</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r, i) => (
                  <tr key={r.phone} className="border-t">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2">
                      {r.name}
                      {r.generated && <span className="text-xs text-muted-foreground"> (kubuni)</span>}
                    </td>
                    <td className="p-2 font-mono">{r.phone}</td>
                    <td className="p-2">
                      <a
                        className="text-primary underline text-xs"
                        href={`https://wa.me/${r.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Fungua
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
