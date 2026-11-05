// This marker contains only an opaque revision, never credentials or profile data.
export const SESSION_REVISION_KEY = "bookflow.session.revision";
const changed = "bookflow:session-changed";
export const coordinationError =
  "Secure session coordination is unavailable. Use an up-to-date browser with site storage enabled over HTTPS or localhost.";
export const sessionChangedError =
  "Your session changed in another tab. Please sign in again.";

export function ensureSessionSupport() {
  if (
    !navigator.locks?.request ||
    typeof AbortSignal.timeout !== "function" ||
    typeof crypto.randomUUID !== "function"
  )
    throw new Error(coordinationError);
}

export function readRevision(): string | null {
  try {
    return localStorage.getItem(SESSION_REVISION_KEY);
  } catch {
    throw new Error(coordinationError);
  }
}

export function writeRevision(revision: string) {
  try {
    localStorage.setItem(SESSION_REVISION_KEY, revision);
  } catch {
    throw new Error(coordinationError);
  }
}

export function notifySessionChange() {
  window.dispatchEvent(new Event(changed));
}

export function canRestore(revision: string | null) {
  return revision === null || /^active:[\w-]+$/.test(revision);
}

export function watchSessionChange(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === SESSION_REVISION_KEY) listener();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(changed, listener);
  window.addEventListener("focus", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(changed, listener);
    window.removeEventListener("focus", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}

export async function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  ensureSessionSupport();
  // Check both read and write access before issuing any authenticated request.
  try {
    const probe = "bookflow.session.storage-check";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    throw new Error(coordinationError);
  }
  return navigator.locks.request(
    "bookflow.session",
    { signal: AbortSignal.timeout(15_000) },
    work,
  );
}
