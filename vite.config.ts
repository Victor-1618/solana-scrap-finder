import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/rpc-proxy': {
        target: 'https://shared.us-east-1.getblock.io/deb382ef5bac4113801854664a0d62cf',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc-proxy/, ''),
      },
    },
  },
})
