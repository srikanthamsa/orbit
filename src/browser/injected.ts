/**
 * This module exports ONE self-contained function that is serialized by
 * chrome.scripting.executeScript. Everything it uses must live inside it:
 * module-scope helpers are not available in the target page.
 *
 * State that must survive between calls (the element registry) lives on
 * globalThis inside the extension's isolated world.
 */
import type { PageSnapshot } from '@/types';

export type PageOp =
  | { op: 'snapshot' }
  | { op: 'click'; elementId: string }
  | { op: 'type'; elementId: string; text: string }
  | { op: 'scroll'; direction: 'up' | 'down'; amount: number }
  | { op: 'press_key'; key: string }
  | { op: 'click_at'; x: number; y: number }
  | { op: 'find'; query: string; role?: string; limit?: number }
  | { op: 'element_at'; x: number; y: number }
  | { op: 'active_element' };

export interface FindMatch {
  id: string;
  tag: string;
  role?: string;
  name: string;
  disabled: boolean;
  inForm: boolean;
  inViewport: boolean;
}

export interface PageOpResult {
  ok: boolean;
  message: string;
  label?: string;
  snapshot?: PageSnapshot;
  find?: FindMatch[];
  element?: { tag: string; type?: string; label: string; inForm: boolean } | null;
  active?: { tag: string; inForm: boolean; label: string } | null;
}

export function pageOperation(input: PageOp): PageOpResult {
  interface Entry {
    el: Element;
    sig: string;
    dx?: number;
    dy?: number;
    frame?: string;
  }
  const store = globalThis as unknown as {
    __ORBIT_REG__?: Map<string, Entry>;
    __ORBIT_LAST__?: Element;
  };
  const registry: Map<string, Entry> = new Map();
  if (input.op !== 'snapshot' && !store.__ORBIT_REG__) {
    return { ok: false, message: 'No page snapshot exists yet. Observe the page first.' };
  }

  const squash = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim();

  const tagOf = (el: Element): string => el.tagName.toLowerCase();
  const windowOf = (el: Element): Window & typeof globalThis =>
    (el.ownerDocument.defaultView ?? window) as Window & typeof globalThis;
  const styleOf = (el: Element): CSSStyleDeclaration => windowOf(el).getComputedStyle(el);
  const rootOf = (el: Element): Document | ShadowRoot =>
    el.getRootNode() as Document | ShadowRoot;
  const lookupId = (el: Element, id: string): HTMLElement | null => {
    const root = rootOf(el) as Document | ShadowRoot;
    return root.getElementById?.(id) ?? el.ownerDocument.getElementById(id);
  };

  const isSensitiveInput = (el: HTMLInputElement): boolean => {
    if ((el.getAttribute('type') ?? '').toLowerCase() === 'password') return true;
    const autocomplete = (el.getAttribute('autocomplete') ?? '').toLowerCase();
    if (
      /(^|\s)(one-time-code|current-password|new-password|cc-number|cc-csc|cc-exp)(\s|$)/.test(
        autocomplete,
      )
    ) {
      return true;
    }
    const style = styleOf(el) as CSSStyleDeclaration & { webkitTextSecurity?: string };
    const security = style.webkitTextSecurity ?? '';
    return security !== '' && security !== 'none';
  };

  const labelOf = (el: Element): string => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const joined = labelledBy
        .split(/\s+/)
        .map((id) => squash(lookupId(el, id)?.textContent))
        .filter(Boolean)
        .join(' ');
      if (joined) return joined;
    }
    const tag = tagOf(el);
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      const labels = (el as HTMLInputElement).labels;
      if (labels && labels.length > 0) {
        const text = squash(labels[0]?.textContent);
        if (text) return text;
      }
      const placeholder = el.getAttribute('placeholder');
      if (placeholder && placeholder.trim()) return placeholder.trim();
      if (tag === 'input') {
        const input = el as HTMLInputElement;
        if (input.type === 'submit' || input.type === 'button') {
          const value = squash(input.value);
          if (value) return value;
        }
      }
    }
    if (tag === 'img') {
      const alt = el.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
    }
    const inner = squash(el.textContent);
    if (inner) return inner.slice(0, 100);
    return squash(
      el.getAttribute('title') ??
        el.getAttribute('placeholder') ??
        el.getAttribute('name') ??
        el.getAttribute('alt') ??
        el.tagName.toLowerCase(),
    );
  };

  const INPUT_TEXT_ROLES = new Set([
    'button',
    'link',
    'textbox',
    'searchbox',
    'combobox',
    'checkbox',
    'radio',
    'switch',
    'slider',
    'spinbutton',
    'option',
    'tab',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'treeitem',
  ]);

  const roleOf = (el: Element): string => {
    const explicit = (el.getAttribute('role') ?? '').trim().toLowerCase();
    if (explicit) return explicit;
    const tag = tagOf(el);
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'button') return 'button';
    if (tag === 'summary') return 'button';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'option') return 'option';
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'hidden') return 'none';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'search') return 'searchbox';
      if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') return 'button';
      return 'textbox';
    }
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'nav') return 'navigation';
    if (tag === 'main') return 'main';
    if (tag === 'header') return 'banner';
    if (tag === 'footer') return 'contentinfo';
    if (tag === 'aside') return 'complementary';
    if (tag === 'form') return 'form';
    if (tag === 'dialog') return 'dialog';
    if (tag === 'ul' || tag === 'ol') return 'list';
    if (tag === 'li') return 'listitem';
    if (tag === 'table') return 'table';
    if (tag === 'tr') return 'row';
    if (tag === 'td') return 'cell';
    if (tag === 'th') return 'columnheader';
    if (tag === 'img') return el.getAttribute('alt') ? 'img' : 'presentation';
    if (tag === 'iframe' || tag === 'frame') return 'iframe';
    if (tag === 'article') return 'article';
    if (tag === 'hr') return 'separator';
    if ((el as HTMLElement).isContentEditable) return 'textbox';
    return 'generic';
  };

  const isControl = (el: Element): boolean =>
    INPUT_TEXT_ROLES.has(roleOf(el)) || el.matches('a[href],button,input,select,textarea,summary,[onclick],[tabindex="0"]');

  const visible = (el: Element): boolean => {
    const style = styleOf(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = (el as HTMLElement).getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };

  const activeDeep = (doc: Document): Element | null => {
    let active = doc.activeElement;
    while (active) {
      if (active.shadowRoot?.activeElement) {
        active = active.shadowRoot.activeElement;
        continue;
      }
      if (active.tagName === 'IFRAME' || active.tagName === 'FRAME') {
        try {
          const inner = (active as HTMLIFrameElement).contentDocument?.activeElement;
          if (inner) {
            active = inner;
            continue;
          }
        } catch {
          // Cross-origin frames cannot be inspected.
        }
      }
      break;
    }
    return active;
  };

  const scrollIntoViewDeep = (el: Element): void => {
    let node: Element | null = el;
    while (node) {
      const frame: Element | null = node.ownerDocument.defaultView?.frameElement ?? null;
      if (!frame) break;
      frame.scrollIntoView({ block: 'center', inline: 'center' });
      node = frame;
    }
    el.scrollIntoView({ block: 'center', inline: 'center' });
  };

  const signature = (el: Element): string =>
    [
      el.tagName.toLowerCase(),
      el.getAttribute('role') ?? '',
      el.getAttribute('type') ?? '',
      el.getAttribute('href') ?? '',
      labelOf(el).slice(0, 80),
    ].join('|');

  const press = (el: Element): void => {
    const init = { bubbles: true, cancelable: true, view: window, button: 0 } as MouseEventInit;
    el.dispatchEvent(new PointerEvent('pointerdown', init));
    el.dispatchEvent(new MouseEvent('mousedown', init));
    el.dispatchEvent(new PointerEvent('pointerup', init));
    el.dispatchEvent(new MouseEvent('mouseup', init));
    if (el instanceof HTMLElement) el.click();
    else el.dispatchEvent(new MouseEvent('click', init));
  };

  const resolve = (id: string): { el: Element; label: string } | { error: string } => {
    const entry = store.__ORBIT_REG__?.get(id);
    if (!entry) return { error: `Element ${id} is not in the latest snapshot. Observe the page again.` };
    if (!entry.el.isConnected) return { error: `Element ${id} is no longer on the page. Observe the page again.` };
    if (entry.sig !== signature(entry.el)) {
      return { error: `Element ${id} changed since the snapshot. Observe the page again before acting.` };
    }
    return { el: entry.el, label: labelOf(entry.el) };
  };

  const viewport = () => ({
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0),
  });

  if (input.op === 'snapshot') {
    const MAX_ELEMENTS = 240;
    const selector = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="menuitemradio"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="slider"]',
      '[role="spinbutton"]',
      '[role="searchbox"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="option"]',
      '[role="treeitem"]',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[contenteditable="plaintext-only"]',
      '[onclick]',
      '[tabindex="0"]',
      'label[for]',
    ].join(',');

    const { width: vw, height: vh } = viewport();
    interface Candidate {
      el: Element;
      dx: number;
      dy: number;
      frame?: string;
    }
    const candidates: Candidate[] = [];
    const seen = new Set<Element>();
    let scanned = 0;

    const collect = (root: ParentNode, dx: number, dy: number, frame?: string): void => {
      for (const el of Array.from(root.querySelectorAll(selector))) {
        if (seen.has(el) || !visible(el)) continue;
        seen.add(el);
        candidates.push({ el, dx, dy, frame });
      }
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (++scanned > 25_000) break;
        if (el.shadowRoot) collect(el.shadowRoot, dx, dy, frame);
      }
      for (const frameEl of Array.from(root.querySelectorAll('iframe,frame'))) {
        if (!visible(frameEl)) continue;
        let doc: Document | null = null;
        try {
          doc = (frameEl as HTMLIFrameElement).contentDocument;
        } catch {
          doc = null;
        }
        if (!doc) continue;
        const rect = frameEl.getBoundingClientRect();
        collect(
          doc,
          dx + rect.left + (frameEl as HTMLIFrameElement).clientLeft,
          dy + rect.top + (frameEl as HTMLIFrameElement).clientTop,
          squash(frameEl.getAttribute('title') ?? 'iframe').slice(0, 40),
        );
      }
    };
    collect(document, 0, 0);

    const screenRect = (candidate: Candidate): DOMRect =>
      candidate.el.getBoundingClientRect();
    const near = (candidate: Candidate): boolean => {
      const r = screenRect(candidate);
      const left = r.left + candidate.dx;
      const top = r.top + candidate.dy;
      return top < vh + 200 && top + r.height > -200 && left < vw + 200 && left + r.width > -200;
    };
    const inViewport = (candidate: Candidate): boolean => {
      const r = screenRect(candidate);
      const left = r.left + candidate.dx;
      const top = r.top + candidate.dy;
      return top < vh && top + r.height > 0 && left < vw && left + r.width > 0;
    };

    candidates.sort((a, b) => Number(near(b)) - Number(near(a)));

    const elements: PageSnapshot['elements'] = [];
    const idByEl = new Map<Element, string>();
    for (const candidate of candidates) {
      if (elements.length >= MAX_ELEMENTS) break;
      const el = candidate.el;
      if (el.getClientRects().length === 0) continue;
      const tag = tagOf(el);
      const nativeInteractive =
        ['a', 'button', 'input', 'select', 'textarea', 'summary', 'label'].includes(tag) ||
        INPUT_TEXT_ROLES.has(el.getAttribute('role') ?? '') ||
        el.hasAttribute('onclick') ||
        (el as HTMLElement).isContentEditable;
      // tabindex-only nodes are common wrappers; keep the ones that actually
      // behave like controls (pointer cursor, bounded size) and expose a label.
      if (!nativeInteractive) {
        if (styleOf(el).cursor !== 'pointer') continue;
        const box = el.getBoundingClientRect();
        if (box.width * box.height > vw * vh * 0.4) continue;
        const text = squash(el.textContent);
        if (!text && !el.getAttribute('aria-label')) continue;
        if (text.length > 80) continue;
        if (el.querySelector('a,button,input,select,textarea,[role="button"],[role="link"]')) continue;
      }
      const name = labelOf(el);
      const isField = tag === 'input' || tag === 'textarea' || tag === 'select';
      const id = `el_${elements.length + 1}`;
      const rect = el.getBoundingClientRect();
      registry.set(id, {
        el,
        sig: signature(el),
        dx: candidate.dx,
        dy: candidate.dy,
        frame: candidate.frame,
      });
      idByEl.set(el, id);
      const input = el as HTMLInputElement;
      elements.push({
        id,
        tag,
        role: el.getAttribute('role') ?? undefined,
        type: el.getAttribute('type') ?? undefined,
        text: squash(el.textContent).slice(0, 120) || undefined,
        accessibleName: name || undefined,
        placeholder: el.getAttribute('placeholder') ?? undefined,
        value: isField ? (isSensitiveInput(el as HTMLInputElement) ? '••••••' : squash(input.value).slice(0, 120)) : undefined,
        href: el.getAttribute('href')?.slice(0, 300) ?? undefined,
        disabled: input.disabled === true || el.getAttribute('aria-disabled') === 'true',
        visible: true,
        inForm: !!el.closest('form'),
        inViewport: inViewport(candidate),
        checked: isField && typeof input.checked === 'boolean' ? input.checked : undefined,
        boundingBox: {
          x: Math.round(rect.x + candidate.dx),
          y: Math.round(rect.y + candidate.dy),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
    }
    store.__ORBIT_REG__ = registry;

    const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'meta', 'link', 'svg']);
    const STRUCTURAL_ROLES = new Set([
      'banner',
      'navigation',
      'main',
      'complementary',
      'contentinfo',
      'form',
      'search',
      'region',
      'dialog',
      'alertdialog',
      'heading',
      'img',
      'iframe',
      'tablist',
      'tabpanel',
      'menu',
      'menubar',
      'toolbar',
      'status',
      'alert',
      'progressbar',
      'table',
    ]);
    const treeLines: string[] = [];
    let treeChars = 0;
    const appendTree = (line: string): void => {
      if (treeLines.length >= 220 || treeChars + line.length > 3200) return;
      treeLines.push(line);
      treeChars += line.length + 1;
    };

    const walkTree = (root: ParentNode, depth: number): void => {
      if (treeLines.length >= 220 || treeChars >= 3200) return;
      for (const el of Array.from(root.children)) {
        const tag = tagOf(el);
        if (SKIP_TAGS.has(tag) || el.getAttribute('aria-hidden') === 'true') continue;
        const role = roleOf(el);
        const id = idByEl.get(el);
        const isKnownControl = !!id || isControl(el);
        const isStructural = STRUCTURAL_ROLES.has(role);
        if ((isKnownControl || isStructural || tag === 'iframe' || el.shadowRoot) && !visible(el)) {
          continue;
        }
        let childDepth = depth;
        if (isKnownControl || isStructural) {
          const displayRole =
            isKnownControl && (role === 'generic' || role === 'presentation') ? 'control' : role;
          const textRole =
            role === 'heading' ||
            role === 'cell' ||
            role === 'columnheader' ||
            role === 'listitem' ||
            role === 'img';
          const name = textRole
            ? squash(el.textContent) || labelOf(el)
            : isKnownControl || role === 'iframe'
              ? labelOf(el)
              : el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '';
          const bits = [`${'  '.repeat(Math.min(depth, 8))}${displayRole}`];
          if (name && name !== displayRole) bits.push(`“${name.slice(0, 90)}”`);
          if (id) bits.push(`[${id}]`);
          const input = el as HTMLInputElement;
          if (input.disabled === true || el.getAttribute('aria-disabled') === 'true') bits.push('[disabled]');
          if (
            typeof input.checked === 'boolean' &&
            (role === 'checkbox' || role === 'radio' || role === 'switch')
          ) {
            bits.push(input.checked ? '[checked]' : '[unchecked]');
          }
          const expanded = el.getAttribute('aria-expanded');
          if (expanded) bits.push(`[expanded=${expanded}]`);
          const selected = el.getAttribute('aria-selected');
          if (selected) bits.push(`[selected=${selected}]`);
          if (el.getAttribute('aria-required') === 'true' || input.required) bits.push('[required]');
          if (el.getAttribute('aria-invalid') === 'true') bits.push('[invalid]');
          const valueNow = el.getAttribute('aria-valuenow');
          if (valueNow) bits.push(`[value=${valueNow}]`);
          appendTree(bits.join(' '));
          childDepth = depth + 1;
          if (isKnownControl) continue;
        }

        if (tag === 'iframe' || tag === 'frame') {
          let doc: Document | null = null;
          try {
            doc = (el as HTMLIFrameElement).contentDocument;
          } catch {
            doc = null;
          }
          if (doc) walkTree(doc, childDepth);
          else appendTree(`${'  '.repeat(Math.min(childDepth, 8))}(cross-origin frame)`);
          continue;
        }
        if (el.shadowRoot) walkTree(el.shadowRoot, childDepth);
        walkTree(el, childDepth);
      }
    };
    walkTree(document, 0);
    const a11yText = treeLines.join('\n');

    const rawText = ((document.documentElement as HTMLElement | null)?.innerText ??
      ((document.body as HTMLElement | null)?.innerText ?? ''));
    const bodyText = rawText.toLowerCase();
    const nameOfEl = (el: PageSnapshot['elements'][number]): string =>
      `${el.accessibleName ?? ''} ${el.text ?? ''}`.trim();

    // innerText only includes rendered text, so this finds a "Notify Me" CTA
    // even when it is off-screen or implemented as a plain element.
    const hasNotifyMe = /\bnotify me\b/i.test(bodyText);
    const hasAddToCart = elements.some((el) =>
      /\b(add to (cart|bag)|buy now)\b/i.test(nameOfEl(el)),
    );

    const signals: string[] = [];
    if (hasNotifyMe && !hasAddToCart) {
      signals.push(
        'OUT OF STOCK — this page offers “Notify Me” but no “Add to cart”/“Buy now” control, so the product cannot be purchased right now.',
      );
    } else if (hasNotifyMe) {
      signals.push('Some items on this page show “Notify Me” (out of stock).');
    } else if (/out of stock|sold out|currently unavailable/i.test(bodyText)) {
      signals.push('Page text mentions out-of-stock items. Confirm availability before buying.');
    }
    if (
      /verify (that )?you are (a )?human|verify you'?re human|i'?m not a robot|i am not a robot|complete the (security )?(check|captcha)|enter the characters you see|unusual traffic from your computer/i.test(
        bodyText,
      )
    ) {
      signals.push('A CAPTCHA or human-verification challenge is present. Stop and ask the user.');
    }
    if (/sign in to continue|log in to continue|login to continue/i.test(bodyText)) {
      signals.push('This page requires the user to sign in before continuing.');
    }
    const looksLikeProductUrl = /\/(p|dp|product|itm|item)\//i.test(location.href);
    if (looksLikeProductUrl && !hasAddToCart && !hasNotifyMe && !/out of stock|sold out/i.test(bodyText)) {
      signals.push('No “Add to cart”/“Buy now” control is present on this product page.');
    }

    const actionLabel = (el: PageSnapshot['elements'][number]): string =>
      el.accessibleName || el.text || '';
    const isActionElement = (el: PageSnapshot['elements'][number]): boolean =>
      ['button', 'a', 'summary'].includes(el.tag) || el.role === 'button' || el.role === 'link';
    const primaryActions = Array.from(
      new Set(
        elements
          .filter((el) => isActionElement(el) && !el.disabled)
          .map(actionLabel)
          .filter(Boolean),
      ),
    ).slice(0, 8);
    const disabledActions = Array.from(
      new Set(elements.filter((el) => el.disabled).map(actionLabel).filter(Boolean)),
    ).slice(0, 6);

    const overlayTexts: string[] = [];
    const pushOverlay = (el: Element | null): void => {
      if (!(el instanceof HTMLElement)) return;
      const text = el.innerText?.trim();
      if (text) overlayTexts.push(text);
    };
    const activeEl = activeDeep(document);
    const seed =
      activeEl instanceof HTMLElement && activeEl !== document.body
        ? activeEl
        : store.__ORBIT_LAST__?.isConnected
          ? store.__ORBIT_LAST__
          : null;
    let overlayNode: HTMLElement | null = seed instanceof HTMLElement ? seed : null;
    for (let depth = 0; overlayNode && depth < 40; depth += 1) {
      const style = getComputedStyle(overlayNode);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const rect = overlayNode.getBoundingClientRect();
        if (rect.width * rect.height > vw * vh * 0.05) {
          pushOverlay(overlayNode);
          break;
        }
      }
      overlayNode = overlayNode.parentElement;
    }
    for (const dialog of Array.from(
      document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]'),
    )) {
      pushOverlay(dialog);
    }
    const overlayText = Array.from(new Set(overlayTexts)).join('\n\n').slice(0, 3000);

    const snapshot: PageSnapshot = {
      url: location.href,
      title: document.title,
      viewport: {
        width: vw,
        height: vh,
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
        scrollHeight: Math.round(document.documentElement.scrollHeight),
      },
      elements,
      textContent:
        rawText.length > 7000
          ? `${rawText.slice(0, 5200)}\n…\n${rawText.slice(-1800)}`
          : rawText,
      a11yText: a11yText || undefined,
      overlayText: overlayText || undefined,
      signals,
      primaryActions,
      disabledActions,
      capturedAt: Date.now(),
    };
    return { ok: true, message: 'Snapshot captured.', snapshot };
  }

  if (input.op === 'find') {
    const query = input.query.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return { ok: true, message: 'Type a label or role to find.', find: [] };
    }
    const roleFilter = input.role?.trim().toLowerCase();
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
    const { width: fw, height: fh } = viewport();
    const matches: FindMatch[] = [];
    for (const [id, entry] of store.__ORBIT_REG__ ?? []) {
      const el = entry.el;
      if (!el.isConnected || !visible(el)) continue;
      const tag = tagOf(el);
      const role = (el.getAttribute('role') ?? roleOf(el)).toLowerCase();
      if (roleFilter && role !== roleFilter && tag !== roleFilter) continue;
      const name = labelOf(el);
      const hay = [
        name,
        squash(el.textContent).slice(0, 240),
        el.getAttribute('placeholder') ?? '',
        el.getAttribute('aria-label') ?? '',
        tag,
        role,
      ]
        .join(' ')
        .toLowerCase();
      if (!tokens.every((token) => hay.includes(token))) continue;
      const rect = el.getBoundingClientRect();
      const left = rect.left + (entry.dx ?? 0);
      const top = rect.top + (entry.dy ?? 0);
      const inView = top < fh && top + rect.height > 0 && left < fw && left + rect.width > 0;
      const inputEl = el as HTMLInputElement;
      matches.push({
        id,
        tag,
        role,
        name: name || squash(el.textContent).slice(0, 90),
        disabled: inputEl.disabled === true || el.getAttribute('aria-disabled') === 'true',
        inForm: !!el.closest('form'),
        inViewport: inView,
      });
      if (matches.length >= limit * 3) break;
    }
    matches.sort((a, b) => {
      const actionA = ['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio'].includes(
        (a.role ?? '').toLowerCase(),
      );
      const actionB = ['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio'].includes(
        (b.role ?? '').toLowerCase(),
      );
      return Number(b.inViewport) - Number(a.inViewport) || Number(actionB) - Number(actionA);
    });
    const limited = matches.slice(0, limit);
    const textHas =
      limited.length === 0 &&
      squash(document.body?.innerText).toLowerCase().includes(query);
    return {
      ok: true,
      message:
        limited.length > 0
          ? `Found ${limited.length} accessible match${limited.length === 1 ? '' : 'es'} for “${input.query}”.`
          : textHas
            ? `No interactive element matched “${input.query}”, but that text appears on the page. Scroll or observe the page for a labeled control.`
            : `No accessible element matched “${input.query}”. Try a shorter label, a role, or a different word.`,
      find: limited,
    };
  }

  if (input.op === 'click') {
    const found = resolve(input.elementId);
    if ('error' in found) return { ok: false, message: found.error };
    scrollIntoViewDeep(found.el);
    if ('focus' in found.el) (found.el as HTMLElement).focus({ preventScroll: true });
    store.__ORBIT_LAST__ = found.el;
    press(found.el);
    return { ok: true, message: `Clicked ${input.elementId} “${found.label}”.`, label: found.label };
  }

  if (input.op === 'type') {
    const found = resolve(input.elementId);
    if ('error' in found) return { ok: false, message: found.error };
    const el = found.el;
    store.__ORBIT_LAST__ = el;
    scrollIntoViewDeep(el);
    const tag = tagOf(el);
    if (tag === 'input') {
      const field = el as HTMLInputElement;
      if (field.type === 'checkbox' || field.type === 'radio') {
        press(field);
        return { ok: true, message: `Toggled ${input.elementId} “${found.label}”.`, label: found.label };
      }
      field.focus({ preventScroll: true });
      field.select();
      const setter = Object.getOwnPropertyDescriptor(windowOf(field).HTMLInputElement.prototype, 'value')?.set;
      setter?.call(field, input.text);
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: input.text }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, message: `Typed ${input.text.length} characters into “${found.label}”.`, label: found.label };
    }
    if (tag === 'textarea') {
      const area = el as HTMLTextAreaElement;
      area.focus({ preventScroll: true });
      area.select();
      const setter = Object.getOwnPropertyDescriptor(windowOf(area).HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, input.text);
      area.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: input.text }));
      area.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, message: `Typed ${input.text.length} characters into “${found.label}”.`, label: found.label };
    }
    if (tag === 'select') {
      const select = el as HTMLSelectElement;
      const wanted = input.text.trim().toLowerCase();
      const option =
        Array.from(select.options).find((o) => squash(o.textContent).toLowerCase() === wanted) ??
        Array.from(select.options).find((o) => squash(o.textContent).toLowerCase().includes(wanted));
      if (!option) return { ok: false, message: `No option matching “${input.text}”.` };
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, message: `Selected “${squash(option.textContent)}”.`, label: found.label };
    }
    if ('isContentEditable' in el && (el as HTMLElement).isContentEditable) {
      const editable = el as HTMLElement;
      editable.focus({ preventScroll: true });
      const doc = editable.ownerDocument;
      const selection = doc.defaultView?.getSelection();
      const range = doc.createRange();
      range.selectNodeContents(editable);
      selection?.removeAllRanges();
      selection?.addRange(range);
      let inserted = false;
      try {
        inserted = doc.execCommand('insertText', false, input.text);
      } catch {
        inserted = false;
      }
      if (!inserted) editable.textContent = input.text;
      editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: input.text }));
      return { ok: true, message: `Typed ${input.text.length} characters into “${found.label}”.`, label: found.label };
    }
    return { ok: false, message: `Element ${input.elementId} cannot accept text.` };
  }

  if (input.op === 'scroll') {
    const delta = input.direction === 'down' ? Math.abs(input.amount) : -Math.abs(input.amount);
    const before = window.scrollY;
    window.scrollBy({ top: delta, left: 0, behavior: 'instant' as ScrollBehavior });

    // Sites like Flipkart put the real content in an inner scroll container,
    // so the window can report 0px of 0px. Walk up from the viewport centre
    // and scroll the nearest scrollable ancestor instead.
    let container: HTMLElement | null = null;
    if (Math.abs(window.scrollY - before) < 5) {
      const { width: vw2, height: vh2 } = viewport();
      let node = document.elementFromPoint(Math.round(vw2 / 2), Math.round(vh2 / 2)) as HTMLElement | null;
      while (node && node !== document.body && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 20
        ) {
          container = node;
          break;
        }
        node = node.parentElement;
      }
      container?.scrollBy({ top: delta, left: 0, behavior: 'instant' as ScrollBehavior });
    }

    const y = Math.round(container ? container.scrollTop : window.scrollY);
    const max = container
      ? Math.max(0, Math.round(container.scrollHeight - container.clientHeight))
      : Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight));
    return {
      ok: true,
      message: `Scrolled ${input.direction}${container ? ' inside the page’s inner scroll area' : ''} to ${y}px of ${max}px.`,
    };
  }

  if (input.op === 'press_key') {
    const active = activeDeep(document);
    const init: KeyboardEventInit = {
      key: input.key,
      code: input.key.length === 1 ? `Key${input.key.toUpperCase()}` : input.key,
      bubbles: true,
      cancelable: true,
    };
    active?.dispatchEvent(new KeyboardEvent('keydown', init));
    active?.dispatchEvent(new KeyboardEvent('keypress', init));
    active?.dispatchEvent(new KeyboardEvent('keyup', init));
    if (input.key === 'Enter' && active) {
      const form = active.closest('form');
      if (form) {
        form.requestSubmit?.();
        return { ok: true, message: 'Pressed Enter and submitted the containing form.' };
      }
      const tag = tagOf(active);
      if (tag === 'button' || tag === 'a') (active as HTMLElement).click();
    }
    return { ok: true, message: `Pressed ${input.key}.` };
  }

  if (input.op === 'click_at') {
    const { width, height } = viewport();
    const px = Math.round(Math.min(Math.max(input.x, 0), 1) * width);
    const py = Math.round(Math.min(Math.max(input.y, 0), 1) * height);
    const el = document.elementFromPoint(px, py);
    if (!el) return { ok: false, message: `Nothing at ${px},${py}.` };
    const label = labelOf(el);
    press(el);
    return { ok: true, message: `Clicked ${px},${py} on “${label}”.`, label };
  }

  if (input.op === 'element_at') {
    const { width, height } = viewport();
    const el = document.elementFromPoint(
      Math.round(Math.min(Math.max(input.x, 0), 1) * width),
      Math.round(Math.min(Math.max(input.y, 0), 1) * height),
    );
    if (!el) return { ok: true, message: 'Nothing at those coordinates.', element: null };
    return {
      ok: true,
      message: 'Found an element.',
      element: {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') ?? undefined,
        label: labelOf(el),
        inForm: !!el.closest('form'),
      },
    };
  }

  if (input.op === 'active_element') {
    const el = activeDeep(document);
    if (!el || el === document.body) return { ok: true, message: 'Nothing focused.', active: null };
    return {
      ok: true,
      message: 'Focused element found.',
      active: { tag: tagOf(el), inForm: !!el.closest('form'), label: labelOf(el) },
    };
  }

  return { ok: false, message: 'Unknown page operation.' };
}
