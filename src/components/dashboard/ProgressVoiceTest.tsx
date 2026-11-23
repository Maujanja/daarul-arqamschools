import { Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProgressAudio } from '@/hooks/useProgressAudio';

export function ProgressVoiceTest({ token, year }: { token?: string; year: string }) {
  const voice = useProgressAudio(`${token || ''}:${year}:test`);
  return <div className="space-y-4 py-4" aria-label="Voice test">
    <h4 className="font-display text-lg font-semibold text-foreground">Kiswahili Voice Test</h4>
    <p lang="sw" className="text-muted-foreground">Karibu DAARUL-ARQAM SCHOOLS. Hii ni sauti ya majaribio ya taarifa za maendeleo ya mtoto.</p>
    <Button variant="outline" disabled={!token || voice.loading} className="gap-2" onClick={() => void voice.generate({ action: 'test-voice', sessionToken: token, year })}>
      {voice.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      {voice.loading ? 'Generating audio…' : voice.url ? 'Play Again' : 'Test Voice'}
    </Button>
    {!token && <p className="text-muted-foreground">Please sign out and sign in again to test voice playback.</p>}
    {voice.url && <audio ref={voice.audioRef} src={voice.url} controls className="w-full max-w-full" aria-label="Kiswahili test audio" onPlay={voice.onPlay} onError={voice.onError} />}
    {voice.needsPlay && <p className="text-warning">Automatic playback was blocked. Press play to listen.</p>}
    {voice.error && <p role="alert" className="text-destructive">{voice.error}</p>}
  </div>;
}