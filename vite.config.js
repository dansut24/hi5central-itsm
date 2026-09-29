import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Hi5Central is deployed at the site root. Using an absolute base keeps
// JS/CSS/assets loading from /assets/... when a user opens a deep SPA URL
// directly (for example /incidents/INC-20661).
export default defineConfig({
  base: '/',
  plugins: [react()],
})
