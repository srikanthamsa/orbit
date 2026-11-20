import { readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

// The E2E build adds <all_urls> so a headless test can drive a local page
// without an interactive host-permission prompt. Never shipped.
const e2e = process.env.ORBIT_E2E === '1';

export default defineConfig({
  srcDir: 'src',
  outDir: e2e ? '.output-e2e' : '.output',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ORBIT',
    short_name: 'ORBIT',
    description: 'An autonomous AI browser agent. Bring your own key. Your browser, your intelligence.',
    version,
    permissions: [
      'sidePanel',
      'storage',
      'tabs',
      'tabGroups',
      'scripting',
      'activeTab',
      'clipboardWrite',
      'declarativeNetRequestWithHostAccess',
    ],
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.deepseek.com/*',
      'https://html.duckduckgo.com/*',
      ...(e2e ? ['<all_urls>'] : []),
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*', '<all_urls>'],
    // The results endpoint refuses requests that carry an extension Origin
    // header. Scoped to the search host and to fetches only.
    declarative_net_request: {
      rule_resources: [{ id: 'search', enabled: true, path: 'rules/search.json' }],
    },
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
