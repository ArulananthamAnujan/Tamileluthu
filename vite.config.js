import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build stamp shown in the footer/More menu, so you can see which version a phone is running.
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
export default defineConfig({ plugins: [react()], define: { __BUILD__: JSON.stringify(stamp) } });
