# Install

ORBIT is a Manifest V3 extension for Chromium browsers. It needs Chrome 116 or newer, or a Chromium browser that ships MV3 extensions and the side panel API. That includes Microsoft Edge, Brave, and Dia.

There is no Chrome Web Store listing yet, so installation means loading the built extension from a folder. Downloading a release avoids Node entirely.

## Download a release

1. Open [the latest release](https://github.com/srikanthamsa/orbit/releases/latest).
2. Download `orbit-<version>-chrome.zip` and unzip it.
3. Keep the unzipped folder somewhere permanent. The browser loads the extension from that path on every launch —moving or deleting the folder breaks it.

The unzipped folder must contain `manifest.json` at its top level. If your unzipper creates an extra directory, use the inner one.

## Load it

**Chrome**

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Choose **Load unpacked** and select the unzipped folder.
4. Pin ORBIT from the puzzle-piece menu, then click its icon. The side panel opens on the right.

**Microsoft Edge:** `edge://extensions` → **Developer mode** → **Load unpacked**.

**Brave:** `brave://extensions` → **Developer mode** → **Load unpacked**.

**Dia**

1. Open Dia's extensions page. Paste `chrome://extensions` into the address bar; if your build sends you elsewhere, use the extensions item in the Dia menu.
2. Turn on **Developer mode**, choose **Load unpacked**, and select the unzipped folder.
3. Click the ORBIT icon in the toolbar. Dia renders Chromium side panels directly, so the panel opens in the window.

Not every Dia build exposes the Developer mode switch. If yours does not, use the same folder in Chrome, Edge or Brave; a store build is the path for Dia once one exists.

**Any other Chromium browser:** open its extensions page, enable developer mode, load the folder.

## First run

1. Open ORBIT → **Settings**.
2. **Add** a provider, pick a model, paste your API key, and press **Test**.
3. Open a normal website tab, then describe the task in ORBIT.

Chrome asks for access to each website the first time ORBIT reads it. **Allow all sites** in Settings is optional: it stops the per-site prompts and enables screenshots for vision models. Keys stay in this browser and go only to your provider.

## Update

1. Download the new zip and unzip it over the same folder you loaded (replace the contents, keep the path).
2. Open the extensions page and press **Reload** on the ORBIT card.
3. Refresh the tab ORBIT controls, then reopen the side panel.

Settings, keys and task history live in extension storage and survive a reload. They are tied to the folder path: loading a copy from a different path gives you a fresh install with empty storage.

## Uninstall

Remove ORBIT from the extensions page first, then delete the folder. Deleting the folder first leaves a broken card that has to be removed manually.

## Troubleshooting

- **“Manifest file is missing or unreadable”** — you selected the zip, or a parent folder. Select the folder that has `manifest.json` directly inside it.
- **“This extension may have been corrupted”** — the folder was moved or deleted. Remove the card and load it again from its current path.
- **The side panel does not open** — Chrome must be 116 or newer. Check that the icon is pinned and click it once; the panel opens beside the tab.
- **An update did not take effect** — press **Reload** on the extensions page and refresh the controlled tab. The version is shown at the bottom of Settings.
- **“Disable developer mode extensions” on startup** — normal for unpacked builds. Dismiss it. Store builds do not show it.
- **ORBIT cannot read a page** — grant access for that site when Chrome asks, or turn on all-sites access in Settings. Chrome's own pages (`chrome://…`, the Web Store) can never be controlled.

## Build from source

Node 20 or newer:

```bash
git clone https://github.com/srikanthamsa/orbit.git
cd orbit
npm install
npm run zip
```

The zip lands in `.output/`, already unpacked in `.output/chrome-mv3`. For development with hot reload, use `npm run dev` and load the directory it prints. See [development.md](development.md).
