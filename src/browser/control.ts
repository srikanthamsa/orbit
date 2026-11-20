export type ControlState = 'working' | 'waiting' | 'paused' | 'hidden' | 'off';

export interface ControlCursor {
  x: number;
  y: number;
  label: string;
  pressed?: boolean;
}

export interface ControlUpdate {
  tabId: number;
  state: ControlState;
  cursor?: ControlCursor;
}

/**
 * The in-page control layer. This function is serialized into the page's
 * isolated world, so it must not reference anything outside itself.
 */
export function orbitControlOverlay(update: ControlUpdate): void {
  const HOST_ID = '__orbit_control__';
  const g = globalThis as unknown as {
    __orbitControl?: { apply(next: ControlUpdate): void; destroy(): void };
    __orbitControlWatchdog?: ReturnType<typeof setTimeout>;
  };

  if (g.__orbitControlWatchdog) {
    clearTimeout(g.__orbitControlWatchdog);
    g.__orbitControlWatchdog = undefined;
  }

  const existing = document.getElementById(HOST_ID);
  if (update.state === 'off') {
    if (g.__orbitControl) {
      g.__orbitControl.destroy();
    } else {
      existing?.remove();
    }
    g.__orbitControl = undefined;
    return;
  }

  let api = g.__orbitControl;
  if (!api || !existing || !existing.isConnected) {
    existing?.remove();
    api = createOverlay();
    g.__orbitControl = api;
  }
  api.apply(update);

  // If the panel disappears without cleaning up, the layer removes itself.
  g.__orbitControlWatchdog = setTimeout(() => {
    try {
      g.__orbitControl?.destroy();
    } finally {
      g.__orbitControl = undefined;
    }
  }, 120_000);

  function createOverlay(): { apply(next: ControlUpdate): void; destroy(): void } {
    const STYLE = `
      :host {
        all: initial;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        pointer-events: none !important;
      }
      .control {
        position: absolute;
        inset: 0;
        pointer-events: none;
        direction: ltr;
        font: 500 12px/1.3 system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .glow { position: absolute; inset: 0; pointer-events: none; transition: opacity .45s cubic-bezier(.22,1,.36,1); }
      .layer { position: absolute; inset: 0; pointer-events: none; }
      .base {
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,.45),
          inset 0 0 12px rgba(255,255,255,.2),
          inset 0 0 34px rgba(173,95,255,.22),
          inset 0 0 72px rgba(71,30,236,.18);
      }
      .sweep { animation: orbit-glow-sweep 5.2s cubic-bezier(.45,0,.55,1) infinite; }
      @keyframes orbit-glow-sweep {
        0%, 100% {
          box-shadow:
            inset 0 8px 18px -6px rgba(255,255,255,.9),
            inset 0 18px 38px -10px rgba(173,95,255,.55),
            inset 0 42px 82px -22px rgba(71,30,236,.5),
            inset 0 72px 140px -46px rgba(71,30,236,.22);
        }
        25% {
          box-shadow:
            inset -8px 0 18px -6px rgba(255,255,255,.9),
            inset -18px 0 38px -10px rgba(173,95,255,.55),
            inset -42px 0 82px -22px rgba(71,30,236,.5),
            inset -72px 0 140px -46px rgba(71,30,236,.22);
        }
        50% {
          box-shadow:
            inset 0 -8px 18px -6px rgba(255,255,255,.9),
            inset 0 -18px 38px -10px rgba(214,10,71,.55),
            inset 0 -42px 82px -22px rgba(49,30,128,.55),
            inset 0 -72px 140px -46px rgba(49,30,128,.25);
        }
        75% {
          box-shadow:
            inset 8px 0 18px -6px rgba(255,255,255,.9),
            inset 18px 0 38px -10px rgba(214,10,71,.55),
            inset 42px 0 82px -22px rgba(49,30,128,.55),
            inset 72px 0 140px -46px rgba(49,30,128,.25);
        }
      }
      .tag {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 9px;
        height: 42px;
        max-width: calc(100vw - 24px);
        padding: 0 8px 0 12px;
        box-sizing: border-box;
        border: 1px solid rgba(255,255,255,.08);
        border-top: 0;
        border-radius: 0 0 14px 14px;
        background: rgba(18,18,24,.94);
        color: #fff;
        box-shadow: 0 10px 30px rgba(0,0,0,.3);
        -webkit-backdrop-filter: blur(14px);
        backdrop-filter: blur(14px);
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
      }
      .mark { display: flex; color: #5a9bff; flex: none; }
      .words {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
        font-size: 12.5px;
        letter-spacing: .01em;
      }
      .stop {
        flex: none;
        height: 26px;
        padding: 0 9px;
        border: 1px solid rgba(255,100,120,.3);
        border-radius: 7px;
        background: rgba(255,90,110,.12);
        color: #ffb3c0;
        font: 600 11.5px/1 system-ui, sans-serif;
        cursor: pointer;
        pointer-events: auto;
        transition: background .15s ease, opacity .15s ease;
      }
      .stop:hover { background: rgba(255,90,110,.2); }
      .stop:disabled { opacity: .6; cursor: default; }
      .cursor-layer {
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0;
        transform: translate3d(-100px, -100px, 0);
        transition: transform .16s cubic-bezier(.2,0,0,1), opacity .12s ease;
        will-change: transform;
        pointer-events: none;
      }
      .cursor-layer[data-on] { opacity: 1; }
      .cursor-arrow {
        position: absolute;
        top: 0;
        left: 0;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,.4));
      }
      .cursor-label {
        position: absolute;
        top: 17px;
        left: 13px;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 3px 7px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 6px;
        background: #14141b;
        color: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,.35);
        font: 500 11px/1.3 system-ui, sans-serif;
      }
      .ring {
        position: absolute;
        top: -17px;
        left: -17px;
        width: 34px;
        height: 34px;
        border: 3px solid #5a9bff;
        border-radius: 50%;
        opacity: 0;
        box-shadow: 0 0 14px rgba(90,155,255,.55);
      }
      .ring.fire { animation: orbit-click-ring .65s ease-out; }
      @keyframes orbit-click-ring {
        0% { opacity: .95; transform: scale(.22); }
        100% { opacity: 0; transform: scale(1); }
      }
      .toast {
        position: absolute;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        padding: 7px 12px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 9px;
        background: rgba(18,18,24,.96);
        color: #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
        font: 500 12px/1.3 system-ui, sans-serif;
        opacity: 0;
        transition: opacity .15s ease;
        pointer-events: none;
      }
      .toast[data-show] { opacity: 1; }
      .control[data-state="waiting"] .sweep { animation-duration: 9s; }
      .control[data-state="paused"] .glow { opacity: .35; }
      .control[data-state="hidden"] .glow,
      .control[data-state="hidden"] .tag,
      .control[data-state="hidden"] .cursor-layer { opacity: 0 !important; }
      .control[data-state="hidden"] .sweep { animation-play-state: paused; }
      .control[data-state="hidden"] .ring { animation: none; }
      @media (prefers-reduced-motion: reduce) {
        .sweep, .ring.fire, .cursor-layer { animation: none !important; transition: none !important; }
      }
    `;

    const node = <K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      className?: string,
    ): HTMLElementTagNameMap[K] => {
      const el = document.createElement(tagName);
      if (className) el.className = className;
      return el;
    };
    const svg = (viewBox: string, width: string, height: string, className?: string) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', viewBox);
      el.setAttribute('width', width);
      el.setAttribute('height', height);
      if (className) el.setAttribute('class', className);
      return el;
    };

    const host = document.createElement('div');
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: 'closed' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(STYLE);
      root.adoptedStyleSheets = [sheet];
    } catch {
      const style = document.createElement('style');
      style.textContent = STYLE;
      root.appendChild(style);
    }

    const control = node('div', 'control');
    control.setAttribute('data-state', 'working');

    const glow = node('div', 'glow');
    glow.setAttribute('aria-hidden', 'true');
    glow.append(node('div', 'layer base'), node('div', 'layer sweep'));

    const tag = node('div', 'tag');
    tag.setAttribute('role', 'status');
    tag.setAttribute('aria-live', 'polite');
    const mark = node('span', 'mark');
    mark.setAttribute('aria-hidden', 'true');
    const markSvg = svg('0 0 20 20', '18', '18');
    const markRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    markRing.setAttribute('cx', '10');
    markRing.setAttribute('cy', '10');
    markRing.setAttribute('r', '6.4');
    markRing.setAttribute('fill', 'none');
    markRing.setAttribute('stroke', 'currentColor');
    markRing.setAttribute('stroke-width', '1.6');
    const markDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    markDot.setAttribute('cx', '16');
    markDot.setAttribute('cy', '6');
    markDot.setAttribute('r', '2');
    markDot.setAttribute('fill', 'currentColor');
    markSvg.append(markRing, markDot);
    mark.appendChild(markSvg);
    const words = node('span', 'words');
    words.textContent = 'ORBIT is working here';
    const stop = node('button', 'stop');
    stop.type = 'button';
    stop.textContent = 'Stop';
    tag.append(mark, words, stop);

    const cursorLayer = node('div', 'cursor-layer');
    cursorLayer.setAttribute('aria-hidden', 'true');
    const cursorArrow = svg('0 0 18 24', '18', '24', 'cursor-arrow');
    const cursorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cursorPath.setAttribute(
      'd',
      'M2 2 L2 19 L6.6 14.4 L10.1 22 L13.4 20.5 L9.9 13.1 L16 13.1 Z',
    );
    cursorPath.setAttribute('fill', '#fff');
    cursorPath.setAttribute('stroke', '#111318');
    cursorPath.setAttribute('stroke-width', '1.4');
    cursorPath.setAttribute('stroke-linejoin', 'round');
    cursorArrow.appendChild(cursorPath);
    const cursorLabel = node('div', 'cursor-label');
    const ring = node('div', 'ring');
    cursorLayer.append(cursorArrow, cursorLabel, ring);

    const toast = node('div', 'toast');
    toast.setAttribute('role', 'alert');

    control.append(glow, tag, cursorLayer, toast);
    root.appendChild(control);
    (document.documentElement || document.body).appendChild(host);

    let currentTabId = update.tabId;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let closing = false;

    // The layer enters and leaves with a fade so the page never flashes a hard
    // violet edge when a task starts or stops.
    control.style.opacity = '0';
    requestAnimationFrame(() => {
      if (closing) return;
      control.style.transition = 'opacity .45s cubic-bezier(.22,1,.36,1)';
      control.style.opacity = '1';
    });

    const reopen = (): void => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = undefined;
      }
      if (!closing) return;
      closing = false;
      control.style.transition = 'none';
      control.style.opacity = '1';
      void control.offsetWidth;
      control.style.transition = 'opacity .45s cubic-bezier(.22,1,.36,1)';
    };

    const showToast = (message: string): void => {
      toast.textContent = message;
      toast.setAttribute('data-show', '');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.removeAttribute('data-show'), 3200);
    };

    stop.addEventListener('click', () => {
      if (stop.disabled) return;
      stop.disabled = true;
      stop.textContent = 'Stopping…';
      let settled = false;
      const fail = (): void => {
        if (settled) return;
        settled = true;
        stop.disabled = false;
        stop.textContent = 'Stop';
        showToast('Stop didn’t reach ORBIT — use the side panel.');
      };
      const safety = setTimeout(fail, 2500);
      const done = (response?: { ok?: boolean }): void => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        if (!response?.ok) {
          stop.disabled = false;
          stop.textContent = 'Stop';
          showToast('Stop didn’t reach ORBIT — use the side panel.');
        }
      };
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
          fail();
          return;
        }
        chrome.runtime.sendMessage(
          { type: 'ORBIT_STOP_TAB', tabId: currentTabId },
          (response?: { ok?: boolean }) => {
            const error = chrome.runtime.lastError;
            done(error ? undefined : response);
          },
        );
      } catch {
        fail();
      }
    });

    return {
      apply(next: ControlUpdate): void {
        reopen();
        currentTabId = next.tabId;
        control.setAttribute('data-state', next.state);
        if (next.state !== 'hidden') {
          stop.disabled = false;
          stop.textContent = 'Stop';
        }
        const text =
          next.state === 'waiting'
            ? 'ORBIT needs your input'
            : next.state === 'paused'
              ? 'ORBIT is paused'
              : 'ORBIT is working here';
        words.textContent = text;
        tag.setAttribute('aria-label', text);

        if (next.cursor) {
          const x = Math.max(0, Math.min(window.innerWidth - 1, next.cursor.x));
          const y = Math.max(0, Math.min(window.innerHeight - 1, next.cursor.y));
          cursorLayer.setAttribute('data-on', '');
          cursorLayer.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
          cursorLabel.textContent = next.cursor.label.slice(0, 48);
          if (next.cursor.pressed) {
            ring.classList.remove('fire');
            void ring.offsetWidth;
            ring.classList.add('fire');
          }
        }
      },
      destroy(): void {
          if (toastTimer) clearTimeout(toastTimer);
        if (closing) return;
        closing = true;
        control.setAttribute('data-state', 'hidden');
        control.style.transition = 'opacity .34s cubic-bezier(.4,0,.2,1)';
        control.style.opacity = '0';
        closeTimer = setTimeout(() => {
          closeTimer = undefined;
          host.remove();
        }, 360);
      },
    };
  }
}

const injections = new Map<number, Promise<void>>();

export async function setControlOverlay(
  tabId: number,
  update: Omit<ControlUpdate, 'tabId'>,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return;
  // Status, cursor, screenshot-hide, and cleanup updates can overlap. Serialize
  // per tab so an older "working" injection can never land after "off".
  const previous = injections.get(tabId) ?? Promise.resolve();
  const next = previous
    .then(async () => {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: orbitControlOverlay,
        args: [
          { tabId, ...update },
        ],
      });
    })
    .catch(() => {
      // Decorative and control affordances must never fail a task on restricted pages.
    });
  injections.set(tabId, next);
  await next;
  if (injections.get(tabId) === next) injections.delete(tabId);
}