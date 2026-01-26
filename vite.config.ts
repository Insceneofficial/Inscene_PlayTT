import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Use process.env for Vercel/production, fallback to loaded env for local dev
    const openaiApiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
    return {
      server: {
        port: 3000,
        host: 'localhost',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(openaiApiKey),
        'process.env.OPENAI_API_KEY': JSON.stringify(openaiApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      preview: {
        port: 3000,
        host: 'localhost',
      }
    };
});
