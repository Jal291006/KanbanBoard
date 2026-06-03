import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- We accidentally deleted this!

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss() // <-- And this!
  ],
  resolve: {
    // This keeps the Supabase login working perfectly
    dedupe: ['react', 'react-dom'],
  },
})