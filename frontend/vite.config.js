import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api → 백엔드(8000). 개발 서버(dev)와 시연용 서버(preview) 모두 같은 규칙.
const proxy = {
  '/api': {
    target: 'http://localhost:8000',
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};

// ngrok 주소로 들어와도 열리게 허용 (시연: scripts/demo.sh)
const allowedHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'];

export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy, allowedHosts },
  preview: { host: true, port: 5173, strictPort: true, proxy, allowedHosts },
});
