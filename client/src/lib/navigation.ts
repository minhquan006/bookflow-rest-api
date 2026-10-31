import { useSyncExternalStore } from "react";

const navigationEvent = "bookflow:navigate";
function locationSnapshot() {
  return window.location.pathname + window.location.search;
}
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(navigationEvent, listener);
  };
}
export function useBrowserLocation() {
  const location = useSyncExternalStore(subscribe, locationSnapshot);
  const index = location.indexOf("?");
  return {
    path: index < 0 ? location : location.slice(0, index),
    search: index < 0 ? "" : location.slice(index),
    navigate,
  };
}
export function navigate(next: string, replace = false, scroll = true) {
  if (!next.startsWith("/") || next.startsWith("//")) return;
  const target = new URL(next, window.location.origin);
  if (target.origin !== window.location.origin) return;
  const path = target.pathname + target.search;
  if (locationSnapshot() === path) return;
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(navigationEvent));
  if (scroll) window.scrollTo?.({ top: 0 });
}
