import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
// The sample archive is served as static files from ../../sample-data/meridian.
export default defineConfig({ plugins: [react()], publicDir: '../../sample-data/meridian' })
