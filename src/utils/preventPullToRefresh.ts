const DEBUG_ENABLED_KEY = 'das-scroll-debug-enabled';
const DEBUG_LOG_KEY = 'das-scroll-debug-log';
const DEBUG_EVENT_NAME = 'das-scroll-debug';

type DebugDetails = Record<string, unknown>;

let installed = false;
let lastTouchY = 0;
let activeScroller: HTMLElement | null = null;
let lastViewportWidth = 0;

function isDebugEnabled() {
  const params = new URLSearchParams(window.location.search);
  const debugParam = params.get('scrollDebug');
  if (debugParam === '1' || debugParam === 'true') {
    localStorage.setItem(DEBUG_ENABLED_KEY, '1');
  } else if (debugParam === '0' || debugParam === 'false') {
    localStorage.removeItem(DEBUG_ENABLED_KEY);
  }
  return localStorage.getItem(DEBUG_ENABLED_KEY) === '1';
}

function writeDebug(eventName: string, details: DebugDetails = {}) {
  if (!isDebugEnabled()) return;
  const entry = {
    at: new Date().toISOString(),
    event: eventName,
    path: window.location.pathname,
    visibilityState: document.visibilityState,
    displayMode: window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    viewportHeight: window.visualViewport?.height ?? window.innerHeight,
    viewportWidth: window.visualViewport?.width ?? window.innerWidth,
    scrollY: Math.round(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0),
    ...details,
  };

  try {
    const previous = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]');
    const next = Array.isArray(previous) ? [...previous.slice(-79), entry] : [entry];
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(next));
  } catch {
    // Debug logging must never affect scrolling.
  }

  window.dispatchEvent(new CustomEvent(DEBUG_EVENT_NAME, { detail: entry }));
  console.warn('[DAS scroll-debug]', eventName, entry);
}

function lockViewportHeight() {
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;

  if (!lastViewportWidth || Math.abs(width - lastViewportWidth) > 4) {
    lastViewportWidth = width;
    document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(height)}px`);
    writeDebug('viewport-height-locked', { width: Math.round(width), height: Math.round(height) });
  }
}

function getScrollableTarget(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof Element ? target : null;

  while (node && node !== document.body && node !== document.documentElement) {
    const element = node as HTMLElement;
    const style = window.getComputedStyle(element);
    const canScroll =
      /(auto|scroll|overlay)/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;

    if (canScroll) return element;
    node = node.parentElement;
  }

  const appScroller = document.querySelector<HTMLElement>('[data-app-scroll-container="true"]');
  if (appScroller && appScroller.scrollHeight > appScroller.clientHeight + 1) {
    return appScroller;
  }

  return null;
}

function keepAwayFromEdges(scroller: HTMLElement | null, reason: string) {
  if (!scroller) return;
  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
  if (maxScrollTop <= 1) return;

  if (scroller.scrollTop <= 0) {
    scroller.scrollTop = 1;
    writeDebug(reason, { adjusted: 'top', target: describeScroller(scroller) });
  } else if (scroller.scrollTop >= maxScrollTop) {
    scroller.scrollTop = maxScrollTop - 1;
    writeDebug(reason, { adjusted: 'bottom', target: describeScroller(scroller) });
  }
}

function describeScroller(scroller: HTMLElement) {
  return scroller.dataset.appScrollContainer === 'true'
    ? 'app-scroll-container'
    : scroller.id || scroller.getAttribute('data-radix-scroll-area-viewport') || scroller.tagName.toLowerCase();
}

function block(event: Event, reason: string, details: DebugDetails) {
  if (event.cancelable) event.preventDefault();
  writeDebug(reason, details);
}

export function installPullToRefreshGuard() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  lockViewportHeight();

  const onTouchStart = (event: TouchEvent) => {
    activeScroller = getScrollableTarget(event.target);
    keepAwayFromEdges(activeScroller, 'touchstart-edge-guard');
    lastTouchY = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const currentY = event.touches[0]?.clientY ?? 0;
    const deltaY = currentY - lastTouchY;
    const scroller = activeScroller || getScrollableTarget(event.target);

    if (!scroller) {
      block(event, 'root-overscroll-blocked', { deltaY: Math.round(deltaY), target: 'document' });
      lastTouchY = currentY;
      return;
    }

    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    const isScrollable = maxScrollTop > 1;
    const isAtTop = !isScrollable || scroller.scrollTop <= 1;
    const isAtBottom = isScrollable && Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight - 1;
    const isPullingPastTop = isAtTop && deltaY > 0;
    const isPushingPastBottom = isAtBottom && deltaY < 0;

    if (isPullingPastTop || isPushingPastBottom || !isScrollable) {
      keepAwayFromEdges(scroller, 'touchmove-edge-guard');
      block(event, 'overscroll-refresh-gesture-blocked', {
        direction: isPullingPastTop ? 'pull-down-at-top' : isPushingPastBottom ? 'push-up-at-bottom' : 'not-scrollable',
        deltaY: Math.round(deltaY),
        target: describeScroller(scroller),
        targetScrollTop: Math.round(scroller.scrollTop),
        targetMaxScrollTop: Math.round(maxScrollTop),
      });
    }

    lastTouchY = currentY;
  };

  const onWheel = (event: WheelEvent) => {
    const scroller = getScrollableTarget(event.target);
    if (!scroller) return;
    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    const isAtTop = scroller.scrollTop <= 0;
    const isAtBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
    if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
      block(event, 'wheel-overscroll-blocked', {
        direction: event.deltaY < 0 ? 'wheel-up-at-top' : 'wheel-down-at-bottom',
        target: describeScroller(scroller),
      });
    }
  };

  const onLifecycle = (event: Event) => {
    writeDebug('page-lifecycle-possible-refresh', { type: event.type });
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  document.addEventListener('wheel', onWheel, { passive: false, capture: true });
  window.visualViewport?.addEventListener('resize', lockViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => {
    lastViewportWidth = 0;
    window.setTimeout(lockViewportHeight, 250);
  });
  window.addEventListener('pagehide', onLifecycle);
  window.addEventListener('beforeunload', onLifecycle);

  writeDebug('pull-to-refresh-guard-ready', { userAgent: navigator.userAgent });
}

export { DEBUG_ENABLED_KEY as SCROLL_DEBUG_ENABLED_KEY, DEBUG_EVENT_NAME as SCROLL_DEBUG_EVENT_NAME, DEBUG_LOG_KEY as SCROLL_DEBUG_LOG_KEY };