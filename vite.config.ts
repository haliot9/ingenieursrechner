import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createConfigHotReloadPlugin } from './scripts/vite-config-hot-reload'

export default defineConfig({
  base: './',
  plugins: [createConfigHotReloadPlugin(), react(), tailwindcss()],
})
