import { useEffect, useState } from "react";

type ApiResponse = {
  data: {
    name: string;
    version: string;
    message: string;
  };
};

export default function App() {
  const [result, setResult] = useState<ApiResponse["data"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function checkConnection() {
      try {
        const response = await fetch("/api/v1", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const body = (await response.json()) as ApiResponse;
        setResult(body.data);
      } catch (error) {
        if (controller.signal.aborted) return;

        setError(
          error instanceof Error ? error.message : "Cannot connect to the API.",
        );
      }
    }

    void checkConnection();

    return () => controller.abort();
  }, []);

  return (
    <main>
      <p>WEB PROGRAMMING & APPLICATIONS · 503073</p>
      <h1>BookFlow</h1>
      <h2>Library Management System</h2>

      <section aria-live="polite">
        {!result && !error && <p>Connecting to the API...</p>}

        {result && (
          <>
            <h3>Connection successful</h3>
            <p>{result.message}</p>
            <p>
              {result.name} · {result.version}
            </p>
          </>
        )}

        {error && (
          <>
            <h3>Connection failed</h3>
            <p>{error}</p>
            <p>Check that the backend is running on port 3000.</p>
          </>
        )}
      </section>
    </main>
  );
}