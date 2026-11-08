import React from "react";
import ReactDOM from "react-dom/client";

// Configure MuPDF WASM binary location before any module loads
(globalThis as any).$libmupdf_wasm_Module = {
  locateFile: (file: string) => {
    return `/assets/${file}`;
  },
};

import { App } from "./App";
import "./styles/theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
