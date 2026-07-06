import { defineConfig } from "vite";
import path from "node:path";

const rootPath = import.meta.dirname;

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      "@": path.resolve(rootPath, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3007",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "clsx",
      "framer-motion",
      "lucide-react",
      "recharts",
      "zustand",
    ],
  },
});
