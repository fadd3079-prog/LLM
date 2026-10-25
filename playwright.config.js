import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    workers: 2,
    timeout: 30000,
    use: { baseURL: 'http://127.0.0.1:8080', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'id-ID', launchOptions: { args: ['--no-sandbox'] } },
    webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:8080', reuseExistingServer: false },
    projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }]
});
