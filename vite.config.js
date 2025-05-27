// vite.config.js
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react()],
//   base: './'
//   // server: {
//   //   allowedHosts: ["2794-2401-4900-8836-87fb-8584-6efc-bf22-44f6.ngrok-free.app"], 
//   // },
// });


// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
