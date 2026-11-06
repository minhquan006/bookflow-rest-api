import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
beforeEach(() => {
  let queue: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (
        _name: string,
        options: { signal?: AbortSignal },
        work: () => Promise<unknown>,
      ) => {
        const next = queue.then(() => {
          options.signal?.throwIfAborted();
          return work();
        });
        queue = next.catch(() => {});
        return next;
      },
    },
  });
});
afterEach(() => cleanup());

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
