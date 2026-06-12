import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installPullToRefreshGuard } from "./utils/preventPullToRefresh";

installPullToRefreshGuard();

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker only for push notifications; it must not cache or refresh pages.
if ("serviceWorker" in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") && host.includes("id-preview--");

  const hasPushSupport = "PushManager" in window && "Notification" in window;

  if (!isInIframe && !isPreviewHost && import.meta.env.PROD && hasPushSupport) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations?.().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
  }
}
