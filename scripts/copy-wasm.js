import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function findWasm(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findWasm(fullPath);
        if (found) return found;
      } else if (entry.name === "mupdf-wasm.wasm") {
        return fullPath;
      }
    }
  } catch {
    // Ignore errors in readdir
  }
  return null;
}

const nodeModulesDir = path.resolve(root, "node_modules");
const wasmSrc = findWasm(nodeModulesDir);

if (wasmSrc && fs.existsSync(wasmSrc)) {
  const targets = [
    path.resolve(root, "apps/web/public/mupdf-wasm.wasm"),
    path.resolve(root, "apps/web/public/assets/mupdf-wasm.wasm"),
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(wasmSrc, target);
  }
  console.log("Copied mupdf-wasm.wasm to public targets from:", wasmSrc);
}
