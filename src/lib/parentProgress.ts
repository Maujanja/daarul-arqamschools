import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export async function invokeProgress(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('parent-progress', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => ({}));
      throw new Error(details.error || 'Unable to load progress. Please try again.');
    }
    throw new Error('Unable to reach the progress service. Please try again.');
  }
  return data;
}

export async function readProgressAudio(response: Response): Promise<Blob> {
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || 'Voice report unavailable. Please try again.');
  }
  if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('audio/mpeg')) {
    throw new Error('The voice service did not return an MP3 file.');
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('The voice service returned an empty MP3 file.');
  return blob;
}

export async function requestProgressAudio(body: Record<string, unknown>, signal?: AbortSignal): Promise<Blob> {
  // functions.invoke decodes audio/mpeg as text; native fetch preserves the binary MP3 bytes.
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-progress`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  });
  return readProgressAudio(response);
}