import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone
  // Other browsers expose display-mode: standalone
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore - iOS only
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function recentlyDismissed() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_TTL_MS;
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (recentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    // iOS Safari has no beforeinstallprompt. Show a custom guide after a short delay.
    let iosTimer: number | undefined;
    if (isIOS()) {
      iosTimer = window.setTimeout(() => setShow(true), 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
    setShowIOSGuide(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
        setDeferred(null);
      } else {
        dismiss();
      }
      return;
    }
    if (isIOS()) {
      setShowIOSGuide(true);
    }
  };

  if (!show) return null;

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[min(92vw,420px)] rounded-2xl border border-sky-300/30 bg-slate-900 p-3 flex items-center gap-3"
        role="dialog"
        aria-label="Install app"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">
            Install Daarul-Arqam
          </p>
          <p className="text-xs text-slate-300 leading-tight mt-0.5">
            Add to your home screen for quick access.
          </p>
        </div>
        <Button
          size="sm"
          onClick={install}
          className="bg-sky-500 hover:bg-sky-400 text-white shrink-0"
        >
          Install
        </Button>
        <button
          aria-label="Dismiss"
          onClick={dismiss}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[10000] bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-sky-300/30 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white">Install on iPhone</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-300">1.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tap the
                  <Share className="inline w-4 h-4 text-sky-300" />
                  <strong>Share</strong> button in Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-300">2.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Scroll down and tap
                  <Plus className="inline w-4 h-4 text-sky-300" />
                  <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-300">3.</span>
                <span>Tap <strong>Add</strong> in the top right.</span>
              </li>
            </ol>
            <Button
              className="w-full mt-4 bg-sky-500 hover:bg-sky-400 text-white"
              onClick={() => setShowIOSGuide(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}