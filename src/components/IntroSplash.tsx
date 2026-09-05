import { useEffect, useRef, useState } from 'react';
import introAsset from '@/assets/intro.mp4.asset.json';

const SEEN_KEY = 'intro-splash-seen';

export default function IntroSplash() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  });
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const finish = () => {
    setFading(true);
    window.setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, '1');
      setVisible(false);
    }, 350);
  };

  useEffect(() => {
    if (!visible) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => finish());
    // Safety timeout in case the video stalls
    const timer = window.setTimeout(finish, 9000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] bg-black flex items-center justify-center"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 350ms ease' }}
      onClick={finish}
    >
      <video
        ref={videoRef}
        src={introAsset.url}
        muted
        autoPlay
        playsInline
        preload="auto"
        disablePictureInPicture
        onEnded={finish}
        onError={finish}
        className="h-full w-auto max-w-full object-contain md:h-auto md:w-auto md:max-h-[92vh] md:aspect-[3/4]"
      />
    </div>
  );
}
