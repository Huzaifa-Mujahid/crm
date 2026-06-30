import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'vendor'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react') || id.includes('node_modules/recharts')) return 'ui'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/@stripe')) return 'stripe'
        },
      },
    },
  },
})
