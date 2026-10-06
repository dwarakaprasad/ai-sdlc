// PROTOTYPE (throwaway): own Vite root so it never touches the real client build.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ root: "prototype/ui-direction", plugins: [react()], server: { port: 5199 } });
