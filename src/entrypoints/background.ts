export default defineBackground(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older Chrome builds may not support the behavior call; the action fallback below covers them.
  });

  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id || !tab.windowId) return;
    chrome.sidePanel?.open({ windowId: tab.windowId }).catch(() => {});
  });
});
