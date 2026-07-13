import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '../../',
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/@tiptap/') || id.includes('/prosemirror')) return 'tiptap-vendor';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react-vendor';
          if (id.includes('/socket.io-client/') || id.includes('/engine.io-client/')) return 'socket-vendor';
          if (id.includes('/node_modules/')) return 'vendor';
        },
      },
    },
  },
})
