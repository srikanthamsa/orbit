import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeTabFailure, isRestrictedUrl, setOrbitGroupState } from '@/browser/tabs';

const tabs = {
  get: vi.fn(),
  group: vi.fn(),
};
const tabGroups = {
  get: vi.fn(),
  update: vi.fn(async () => ({})),
};

beforeEach(() => {
  tabs.get.mockReset();
  tabs.group.mockReset();
  tabGroups.get.mockReset();
  tabGroups.update.mockClear();
  vi.stubGlobal('chrome', { tabs, tabGroups });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ORBIT tab group', () => {
  it('creates a group for an ungrouped tab and colours it by state', async () => {
    tabs.get.mockResolvedValue({ id: 7, groupId: -1 });
    tabs.group.mockResolvedValue(42);
    tabGroups.get.mockResolvedValue({ id: 42, title: 'ORBIT' });

    await setOrbitGroupState(7, 'waiting');

    expect(tabs.group).toHaveBeenCalledWith({ tabIds: [7] });
    expect(tabGroups.update).toHaveBeenCalledWith(42, expect.objectContaining({ title: 'ORBIT' }));
    expect(tabGroups.update).toHaveBeenLastCalledWith(
      42,
      expect.objectContaining({ title: 'ORBIT', color: 'orange' }),
    );
  });

  it('does not hijack a group the user already made', async () => {
    tabs.get.mockResolvedValue({ id: 7, groupId: 9 });
    tabGroups.get.mockResolvedValue({ id: 9, title: 'Work' });

    await setOrbitGroupState(7, 'failed');

    expect(tabs.group).not.toHaveBeenCalled();
    expect(tabGroups.update).not.toHaveBeenCalled();
  });

  it('recolours an existing ORBIT group', async () => {
    tabs.get.mockResolvedValue({ id: 7, groupId: 9 });
    tabGroups.get.mockResolvedValue({ id: 9, title: 'ORBIT' });

    await setOrbitGroupState(7, 'done');

    expect(tabGroups.update).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ title: 'ORBIT', color: 'green' }),
    );
  });

  it('stays silent when the tabGroups API is unavailable', async () => {
    vi.stubGlobal('chrome', { tabs });
    await expect(setOrbitGroupState(7, 'working')).resolves.toBeUndefined();
    expect(tabs.group).not.toHaveBeenCalled();
  });
});
describe('restricted tabs', () => {
  it('refuses the Web Store on both hosts', () => {
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/orbit')).toBe(true);
    expect(isRestrictedUrl('https://chrome.google.com/webstore/devconsole')).toBe(true);
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl(undefined)).toBe(true);
  });

  it('allows ordinary sites', () => {
    expect(isRestrictedUrl('https://www.flipkart.com/philips/p/itm123')).toBe(false);
    expect(isRestrictedUrl('https://duckduckgo.com/?q=test')).toBe(false);
  });

  it('turns Chrome scripting refusals into an instruction', () => {
    const message = 'The extensions gallery cannot be scripted.';
    expect(describeTabFailure(message)).toContain('Open a website tab instead');
    expect(describeTabFailure('Element not found')).toBe('Element not found');
  });
});
