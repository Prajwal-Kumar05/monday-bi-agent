import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react],
  preview: {
    allowedHosts: ['monday-bi-agent2.onrender.com']
  }
});