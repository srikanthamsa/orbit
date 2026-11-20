import { defineConfig } from 'wxt';

// The E2E build adds <all_urls> so a headless test can drive a local page
// without an interactive host-permission prompt. Never shipped.
const e2e = process.env.ORBIT_E2E === '1';

export default defineConfig({
  srcDir: 'src',
  outDir: e2e ? '.output-e2e' : '.output',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ORBIT — Browser Agent',
    short_name: 'ORBIT',
    description: 'An autonomous AI browser agent. Bring your own key. Your browser, your intelligence.',
    version: '0.3.0',
    permissions: ['sidePanel', 'storage', 'tabs', 'tabGroups', 'scripting', 'activeTab', 'clipboardWrite'],
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.deepseek.com/*',
      ...(e2e ? ['<all_urls>'] : []),
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*', '<all_urls>'],
    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'Open ORBIT' },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    minimum_chrome_version: '116',
  },
});
