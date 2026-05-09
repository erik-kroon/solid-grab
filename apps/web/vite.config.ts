import tailwindcss from "@tailwindcss/vite";
import { solidGrab } from "solid-grab/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidGrab(), solidPlugin(), tailwindcss()],
  server: {
    port: 3001,
  },
});
