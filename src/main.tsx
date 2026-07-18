import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { initWasm } from './wasm/index.ts'

const root = createRoot(document.getElementById('root')!);

initWasm()
  .then(() => {
    root.render(
      <StrictMode>
        <App wasmError={null} />
      </StrictMode>
    );
  })
  .catch((err) => {
    console.error("Fallo crítico al inicializar WebAssembly:", err);
    root.render(
      <StrictMode>
        <App wasmError={err instanceof Error ? err.message : String(err)} />
      </StrictMode>
    );
  });

