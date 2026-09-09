import { useCallback, useEffect, useRef, useState } from 'react';

const INTRO_MP4_SRC = '/intro.mp4?v=20260905-3';
const INTRO_WEBM_SRC = '/intro.webm?v=20260905-3';

export default function IntroSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishingRef = useRef(false);

  const finish = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFading(true);
    window.setTimeout(() => {
      setVisible(false);
    }, 350);
  }, []);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || finishingRef.current) return;
    video.muted = true;
    void video.play().catch(() => {
      // Some Android WebViews reject an early autoplay request. Keep the
      // splash visible and retry when the media reports that it can play.
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    startPlayback();
    const timer = window.setTimeout(finish, 15000);
    return () => window.clearTimeout(timer);
  }, [finish, startPlayback, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-background"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 350ms ease' }}
      onClick={startPlayback}
    >
      <div className="h-full w-full md:h-[92vh] md:w-auto md:aspect-[3/4] overflow-hidden">
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          preload="auto"
          poster="/intro-poster.jpg?v=20260905-3"
          disablePictureInPicture
          onLoadedData={startPlayback}
          onCanPlay={startPlayback}
          onEnded={finish}
          className="h-full w-full bg-background object-cover md:object-contain"
        >
          <source src={INTRO_MP4_SRC} type="video/mp4" />
          <source src={INTRO_WEBM_SRC} type="video/webm" />
        </video>
      </div>
    </div>
  );
}
