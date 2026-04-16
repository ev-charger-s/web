import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    base: '/',
    plugins: [react(), tailwindcss()],
    server: {
        allowedHosts: ['localhost-vite.mobulum.xyz', 'chargers.mobulum.com', ' ev-charger-s.github.io'],
    },
})
