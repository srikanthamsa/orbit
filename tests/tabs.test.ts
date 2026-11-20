import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setOrbitGroupState } from '@/browser/tabs';

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