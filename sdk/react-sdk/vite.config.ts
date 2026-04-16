import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from "path";

// Anything React-ecosystem stays external so consumer's single instance is used
// at runtime (avoids broken hooks / duplicated context). Pure utilities are
// bundled to keep the SDK self-contained.
const externalDeps = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react-router-dom",
  "zustand",
  "@xyflow/react",
  "@monaco-editor/react",
];

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: "src",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      // Rollup the generated .d.ts files into a single dist/index.d.ts so the
      // package.json `types` entry resolves cleanly.
      rollupTypes: true,
      tsconfigPath: path.resolve(__dirname, "tsconfig.json"),
    }),
  ],
  resolve: {
    alias: {
      "@workflow/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@": path.resolve(__dirname, "../../apps/frontend/src"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "WorkflowUI",
      formats: ["es", "cjs"],
      fileName: (format) => format === "es" ? "index.js" : "index.cjs",
    },
    rollupOptions: {
      external: (id) => externalDeps.some((dep) => id === dep || id.startsWith(dep + "/")),
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-router-dom": "ReactRouterDOM",
          zustand: "zustand",
          "@xyflow/react": "XyflowReact",
          "@monaco-editor/react": "MonacoEditor",
        },
      },
    },
    cssCodeSplit: false, // Produce a single style.css
    sourcemap: true,
  },
});
