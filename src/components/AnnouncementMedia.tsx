import { useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  linkUrl?: string | null;
  compact?: boolean;
}

function attachmentName(mediaUrl: string, mediaName?: string | null) {
  if (mediaName?.trim()) return mediaName.trim();
  try {
    const pathName = new URL(mediaUrl).pathname.split('/').pop();
    return pathName ? decodeURIComponent(pathName) : 'announcement-attachment';
  } catch {
    return 'announcement-attachment';
  }
}

export function AnnouncementMedia({ mediaUrl, mediaType, mediaName, linkUrl, compact }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const hasMedia = !!mediaUrl;
  const hasLink = !!linkUrl && linkUrl.trim().length > 0;
  if (!hasMedia && !hasLink) return null;

  const type = (mediaType || '').toLowerCase();
  const isImage = type.startsWith('image');
  const isVideo = type.startsWith('video');
  const isAudio = type.startsWith('audio');
  const isPdf = type.includes('pdf');
  const fileName = hasMedia ? attachmentName(mediaUrl!, mediaName) : '';

  const normalizedLink = hasLink
    ? (/^https?:\/\//i.test(linkUrl!) ? linkUrl! : `https://${linkUrl}`)
    : '';

  const downloadAttachment = async () => {
    if (!mediaUrl) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error('Attachment could not be downloaded.');
      const blob = await response.blob();
      if (!blob.size) throw new Error('The attachment is empty.');
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Attachment could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
      {hasMedia && isImage && (
        <a href={mediaUrl!} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={mediaUrl!}
            alt={fileName || 'Announcement attachment'}
            className="rounded-lg max-h-72 w-auto border border-border/60 object-contain bg-muted/20"
            loading="lazy"
          />
        </a>
      )}
      {hasMedia && isVideo && (
        <video
          src={mediaUrl!}
          controls
          playsInline
          className="rounded-lg max-h-80 w-full border border-border/60 bg-muted"
        />
      )}
      {hasMedia && isAudio && (
        <audio src={mediaUrl!} controls preload="metadata" className="w-full" />
      )}
      {hasMedia && isPdf && (
        <a
          href={mediaUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-card-foreground hover:bg-muted transition-colors"
        >
          <FileText className="w-4 h-4 text-primary" />
          Open PDF document
        </a>
      )}
      {hasMedia && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-w-full gap-2"
            onClick={() => void downloadAttachment()}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Download className="w-4 h-4 shrink-0" />}
            <span className="truncate">{downloading ? 'Preparing download…' : `Download ${fileName}`}</span>
          </Button>
          {downloadError && <p className="text-xs text-destructive">{downloadError}</p>}
        </div>
      )}
      {hasMedia && !isImage && !isVideo && !isAudio && !isPdf && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="w-3.5 h-3.5" /> Attachment: {fileName}
        </p>
      )}
      {hasLink && (
        <a
          href={normalizedLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors break-all"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-[260px] sm:max-w-md">{normalizedLink}</span>
        </a>
      )}
    </div>
  );
}
