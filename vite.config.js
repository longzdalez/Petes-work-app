import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { makeIcons } from './src/build/make-icons.js'

// Draws the home-screen icons into public/icons/ at the start of every build and dev server
const appIcons = { name: 'app-icons', buildStart() { makeIcons('public/icons') } }

export default defineConfig({ base: './', plugins: [appIcons, react()], build: { chunkSizeWarningLimit: 2000 } })
