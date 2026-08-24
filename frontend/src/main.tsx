import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App";

// Service worker só de push (frontend/public/sw.js): registrar sempre mantém a
// versão atualizada a cada visita, e sem handler de fetch isso é inócuo.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
