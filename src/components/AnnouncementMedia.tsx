import { FileText, ExternalLink } from 'lucide-react';

interface Props {
  mediaUrl?: string | null;
  mediaType?: string | null;
  linkUrl?: string | null;
  compact?: boolean;
}

export function AnnouncementMedia({ mediaUrl, mediaType, linkUrl, compact }: Props) {
  const hasMedia = !!mediaUrl;
  const hasLink = !!linkUrl && linkUrl.trim().length > 0;
  if (!hasMedia && !hasLink) return null;

  const type = (mediaType || '').toLowerCase();
  const isImage = type.startsWith('image');
  const isVideo = type.startsWith('video');
  const isPdf = type.includes('pdf');

  const normalizedLink = hasLink
    ? (/^https?:\/\//i.test(linkUrl!) ? linkUrl! : `https://${linkUrl}`)
    : '';

  return (
    <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
      {hasMedia && isImage && (
        <a href={mediaUrl!} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={mediaUrl!}
            alt="Announcement media"
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
          className="rounded-lg max-h-80 w-full border border-border/60 bg-black"
        />
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
      {hasMedia && !isImage && !isVideo && !isPdf && (
        <a
          href={mediaUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-card-foreground hover:bg-muted transition-colors"
        >
          <FileText className="w-4 h-4 text-primary" />
          Open attachment
        </a>
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