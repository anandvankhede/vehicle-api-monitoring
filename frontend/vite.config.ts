import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // API requests use VITE_API_BASE_URL from .env via src/config/env.ts.
  // No dev-server proxy — avoids overriding the configured API base URL.
})
