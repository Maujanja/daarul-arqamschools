import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DISMISS_KEY = "push-prompt-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 3;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function EnableNotifications() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_TTL_MS;

    if (Notification.permission === "default" && !recentlyDismissed) {
      const t = window.setTimeout(() => setShow(true), 4000);
      return () => window.clearTimeout(t);
    }
  }, []);

  // Whenever user identity changes, re-tag the existing push subscription
  // so notifications are routed correctly for this device's CURRENT user.
  useEffect(() => {
    if (!user) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;

    const lastTag = localStorage.getItem("push-tag-key");
    const tagKey = `${user.role}:${user.id}`;
    if (lastTag === tagKey) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const { error } = await supabase.functions.invoke("push-subscribe", {
          body: {
            action: "subscribe",
            subscription: sub.toJSON(),
            userIdentifier: user.id,
            userRole: user.role,
          },
        });
        if (!error) localStorage.setItem("push-tag-key", tagKey);
      } catch (e) {
        console.error("Re-tag push subscription failed", e);
      }
    })();
  }, [user?.id, user?.role]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Umekataa ruhusa ya notifications");
        dismiss();
        return;
      }

      const VAPID_PUBLIC_KEY =
        "BCuCw2Qrvqr-lIQ5MmRlJMrVDJxIX-vCIe1_xjEqIzUFyU8157kzAGlKdyOMddR__53XPC0Pt1pWS2CufD4d5MQ";
      const vapidPublic =
        (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || VAPID_PUBLIC_KEY;
      if (!vapidPublic) {
        toast.error("VAPID public key haijawekwa.");
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublic),
        });
      }

      const { error } = await supabase.functions.invoke("push-subscribe", {
        body: {
          action: "subscribe",
          subscription: sub.toJSON(),
          userIdentifier: user?.id ?? null,
          userRole: user?.role ?? null,
        },
      });
      if (error) throw error;

      toast.success("Umejiandikisha kupokea notifications!");
      try {
        localStorage.setItem("push-tag-key", `${user?.role}:${user?.id}`);
      } catch {}
      setShow(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Imeshindikana: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;
  if (!show || permission !== "default") return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998] w-[min(92vw,420px)] rounded-2xl border border-sky-300/30 bg-slate-900/95 shadow-[0_10px_40px_-10px_rgba(56,189,248,0.45)] p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-500"
      role="dialog"
      aria-label="Enable notifications"
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0">
        <Bell className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">Pokea matangazo</p>
        <p className="text-xs text-slate-300 leading-tight mt-0.5">
          Ruhusu notifications ili upate matangazo ya shule mara moja.
        </p>
      </div>
      <Button
        size="sm"
        onClick={enable}
        disabled={busy}
        className="bg-sky-500 hover:bg-sky-400 text-white shrink-0"
      >
        {busy ? "..." : "Allow"}
      </Button>
      <button
        aria-label="Dismiss"
        onClick={dismiss}
        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}