import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readDevConfig } from "../scripts/dev-config.ts";

export default defineConfig(() => {
  const { apiOrigin, webPort } = readDevConfig();
  return {
    plugins: [react()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: Object.fromEntries(
        ["/api", "/docs", "/openapi.yaml", "/health"].map((path) => [
          path,
          { target: apiOrigin, changeOrigin: true },
        ]),
      ),
    },
  };
});
