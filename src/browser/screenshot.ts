async function downscale(dataUrl: string, maxWidth = 1100, quality = 0.62): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const buffer = await out.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } catch {
    return dataUrl;
  }
}

export async function captureScreenshot(windowId?: number): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.captureVisibleTab) {
    throw new Error('Screenshots are not available here.');
  }
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, {
      format: 'jpeg',
      quality: 60,
    });
    return await downscale(dataUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/activeTab|permission/i.test(message)) {
      throw new Error('Chrome needs permission to capture this tab. Focus the tab and retry.');
    }
    throw new Error(`Screenshot failed: ${message}`);
  }
}
