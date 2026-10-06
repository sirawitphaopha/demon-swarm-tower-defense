import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// ใช้ Chromium ที่ติดตั้งไว้ในเครื่อง (ถ้ามี) ไม่งั้นใช้ของ Playwright เอง (npx playwright install chromium)
const LOCAL_CHROMIUM = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      executablePath: existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined,
      // เครื่องที่ไม่มี GPU (CI) ใช้ software WebGL
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
