import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installPullToRefreshGuard } from "./utils/preventPullToRefresh";

installPullToRefreshGuard();

createRoot(document.getElementById("root")!).render(<App />);

// Remove old app-shell service workers/caches. Push uses /push-sw.js only, registered on demand.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((registration) => {
        const scriptUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
        if (/\/(sw|service-worker)\.js($|\?)/.test(scriptUrl)) {
          registration.unregister().catch(() => {});
        }
      });
    }).catch(() => {});

    if ("caches" in window) {
      caches.keys().then((keys) => {
        const oldAppCaches = keys.filter((key) =>
          key.startsWith("daarul-arqam-") ||
          /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(key)
        );
        return Promise.allSettled(oldAppCaches.map((key) => caches.delete(key)));
      }).catch(() => {});
    }
  });
}
