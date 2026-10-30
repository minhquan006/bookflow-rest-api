import { useEffect, useState } from "react";

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const changed = () => setPath(window.location.pathname);
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, []);
  function navigate(next: string) {
    if (!next.startsWith("/") || next.startsWith("//")) return;
    window.history.pushState(null, "", next);
    setPath(next.split("?")[0] || "/");
    window.scrollTo?.({ top: 0 });
  }
  return { path, navigate };
}
