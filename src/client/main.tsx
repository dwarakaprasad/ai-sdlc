// Nunito is bundled into the build and served by Home Tutor itself, never from a font CDN (ADR 0001).
import "@fontsource-variable/nunito";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./components/components.css";
import "./learner/learner.css";
import "./learner/session.css";
import "./parent/parent.css";
import { text } from "./text";

document.title = text.appName;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
