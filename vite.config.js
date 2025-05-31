
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // server: {
  //   allowedHosts: ['a6e0-2401-4900-8836-1970-b832-82a0-a9b6-65bc.ngrok-free.app'],
  //   port: 5173,
  // },
  
})
