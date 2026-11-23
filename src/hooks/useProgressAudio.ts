import { useCallback, useEffect, useRef, useState } from 'react';
import { requestProgressAudio } from '@/lib/parentProgress';

export function useProgressAudio(resetKey: string) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPlay, setNeedsPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<AbortController | null>(null);
  const urlRef = useRef('');
  const generation = useRef(0);
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try { audio.currentTime = 0; await audio.play(); setNeedsPlay(false); }
    catch { setNeedsPlay(true); }
  }, []);
  useEffect(() => {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = ''; setUrl(''); setLoading(false); setError(''); setNeedsPlay(false);
    return () => {
      generation.current++; controller.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [resetKey]);
  useEffect(() => { if (url) void play(); }, [url, play]);
  const generate = useCallback(async (body: Record<string, unknown>) => {
    if (urlRef.current) { await play(); return; }
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    const id = ++generation.current;
    setLoading(true); setError('');
    try {
      const blob = await requestProgressAudio(body, abort.signal);
      if (id !== generation.current) return;
      const nextUrl = URL.createObjectURL(blob); urlRef.current = nextUrl; setUrl(nextUrl);
    } catch (e) {
      if (id === generation.current && !abort.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to generate audio.');
    } finally {
      if (id === generation.current) { setLoading(false); controller.current = null; }
    }
  }, [play]);
  return { url, loading, error, needsPlay, audioRef, generate, onPlay: () => setNeedsPlay(false),
    onError: () => setError('This audio could not be played. Please try again.') };
}