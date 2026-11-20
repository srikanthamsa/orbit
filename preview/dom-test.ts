import { pageOperation } from '@/browser/injected';

/**
 * Validates that pageOperation survives serialization (the same thing Chrome
 * does for scripting.executeScript) and behaves correctly in a live DOM.
 */
export function runDomSelfTest(): void {
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
  const record = (name: string, pass: boolean, detail = '') => checks.push({ name, pass, detail });

  document.body.innerHTML = `
    <main style="font-family: sans-serif; padding: 24px">
      <h1>ORBIT DOM test</h1>
      <button id="btn">Search</button>
      <input id="q" placeholder="Search products" />
      <a href="#results">View all results</a>
      <div style="height: 2400px"></div>
      <p id="tail">tail</p>
    </main>`;

  let fn: typeof pageOperation;
  try {
    fn = new Function(`return (${pageOperation.toString()})`)() as typeof pageOperation;
    record('serializes without outer references', true);
  } catch (err) {
    record('serializes without outer references', false, String(err));
    finish(checks);
    return;
  }

  let clicked = 0;
  const button = document.getElementById('btn') as HTMLButtonElement;
  button.addEventListener('click', () => {
    clicked += 1;
  });

  let inputEvents = 0;
  const input = document.getElementById('q') as HTMLInputElement;
  input.addEventListener('input', () => {
    inputEvents += 1;
  });

  const snap = fn({ op: 'snapshot' });
  const elements = snap.snapshot?.elements ?? [];
  record('snapshot captures the page', snap.ok && elements.length >= 3, `${elements.length} elements`);

  const buttonEl = elements.find((el) => el.accessibleName === 'Search');
  const inputEl = elements.find((el) => el.accessibleName === 'Search products');
  record('snapshot exposes accessible names', !!buttonEl && !!inputEl);

  if (buttonEl) {
    const res = fn({ op: 'click', elementId: buttonEl.id });
    record('click dispatches a real click', res.ok && clicked === 1, res.message);
  }

  if (inputEl) {
    const res = fn({ op: 'type', elementId: inputEl.id, text: 'headphones' });
    record('type sets value and fires input', res.ok && input.value === 'headphones' && inputEvents >= 1, res.message);
  }

  const before = window.scrollY;
  const scrolled = fn({ op: 'scroll', direction: 'down', amount: 500 });
  record('scroll moves the page', scrolled.ok && window.scrollY > before, scrolled.message);

  const at = fn({ op: 'element_at', x: 0.5, y: 0.5 });
  record('element_at finds a node', at.ok && !!at.element, at.element?.tag ?? 'none');

  const snap2 = fn({ op: 'snapshot' });
  const secondButton = snap2.snapshot?.elements.find((el) => el.accessibleName === 'Search');
  if (secondButton) {
    button.textContent = 'Search everything';
    const stale = fn({ op: 'click', elementId: secondButton.id });
    record('stale element ids are rejected', !stale.ok && /changed since the snapshot/i.test(stale.message), stale.message);
    button.textContent = 'Search';
  } else {
    record('stale element ids are rejected', false, 'button missing from second snapshot');
  }

  const unknown = fn({ op: 'click', elementId: 'el_999' });
  record('unknown ids are rejected', !unknown.ok, unknown.message);

  document.body.innerHTML = `
    <main style="padding: 24px">
      <h1>SONY PS5 Console</h1>
      <p>This item is currently unavailable online.</p>
      <button>Notify Me</button>
    </main>`;
  const oos = fn({ op: 'snapshot' });
  const oosSignals = oos.snapshot?.signals ?? [];
  record(
    'detects Notify Me as out of stock',
    oosSignals.some((signal) => signal.startsWith('OUT OF STOCK')),
    oosSignals[0] ?? 'no signal',
  );

  document.body.innerHTML = `
    <main style="padding: 24px">
      <h1>PS5 controller</h1>
      <button>Notify Me</button>
      <button>Add to cart</button>
      <button disabled>Sold out</button>
    </main>`;
  const mixed = fn({ op: 'snapshot' });
  const mixedSignals = mixed.snapshot?.signals ?? [];
  record(
    'keeps availability when Add to cart exists',
    !mixedSignals.some((signal) => signal.startsWith('OUT OF STOCK')),
    mixedSignals.join(' | ') || 'no strong signal',
  );
  const inventory = mixed.snapshot?.primaryActions ?? [];
  const disabled = mixed.snapshot?.disabledActions ?? [];
  record(
    'inventories available and disabled actions',
    inventory.includes('Add to cart') && disabled.includes('Sold out'),
    `actions: ${inventory.join(', ')} | disabled: ${disabled.join(', ') || 'none'}`,
  );

  document.body.innerHTML = `
    <main style="padding: 24px">
      <h1>Store</h1>
      <p>This site is protected by reCAPTCHA and the Google Privacy Policy apply.</p>
      <button>Continue</button>
    </main>`;
  const badge = fn({ op: 'snapshot' });
  record(
    'ignores reCAPTCHA footer badges',
    !(badge.snapshot?.signals ?? []).some((signal) => /CAPTCHA/i.test(signal)),
    (badge.snapshot?.signals ?? []).join(' | ') || 'no signal',
  );

  document.body.innerHTML = `
    <main style="padding: 24px">
      <h1>Verify you are human</h1>
      <p>Complete the check to continue.</p>
    </main>`;
  const challenge = fn({ op: 'snapshot' });
  record(
    'detects a real CAPTCHA challenge',
    (challenge.snapshot?.signals ?? []).some((signal) => /CAPTCHA/i.test(signal)),
    (challenge.snapshot?.signals ?? []).join(' | ') || 'no signal',
  );

  document.body.innerHTML = `
    <main style="padding: 24px">
      <div id="emi" tabindex="0" style="cursor: pointer; display: inline-block">View EMI offers</div>
      <div tabindex="0">Plain wrapper</div>
    </main>`;
  let emiClicks = 0;
  document.getElementById('emi')?.addEventListener('click', () => {
    emiClicks += 1;
  });
  const tabSnap = fn({ op: 'snapshot' });
  const tabElements = tabSnap.snapshot?.elements ?? [];
  const emiEl = tabElements.find((el) => el.accessibleName === 'View EMI offers');
  const plainEl = tabElements.find((el) => el.accessibleName === 'Plain wrapper');
  record(
    'captures tabindex-only click targets',
    !!emiEl && !plainEl,
    emiEl ? `found ${emiEl.id}` : 'missing',
  );
  if (emiEl) {
    const res = fn({ op: 'click', elementId: emiEl.id });
    record('clicks a tabindex-only control', res.ok && emiClicks === 1, res.message);
  } else {
    record('clicks a tabindex-only control', false, 'target missing');
  }

  document.body.innerHTML = `
    <main style="padding: 24px"><p>Product page</p></main>
    <div style="position: fixed; right: 0; top: 0; width: 300px; height: 400px; z-index: 9999; background: #fff; padding: 16px">
      <input id="pin" placeholder="Enter pincode" />
      <p>No seller ships to this pin code.</p>
    </div>`;
  const overlayFirst = fn({ op: 'snapshot' });
  const pinEl = (overlayFirst.snapshot?.elements ?? []).find((el) => el.placeholder === 'Enter pincode');
  if (pinEl) {
    fn({ op: 'type', elementId: pinEl.id, text: '490001' });
  }
  const overlaySnap = fn({ op: 'snapshot' });
  record(
    'captures active overlay text',
    /No seller ships/.test(overlaySnap.snapshot?.overlayText ?? ''),
    overlaySnap.snapshot?.overlayText?.slice(0, 90) ?? 'no overlay text',
  );

  document.body.innerHTML = `
    <main style="padding: 24px">
      <label>One-time code <input id="otp" autocomplete="one-time-code" value="123456" /></label>
      <label>Email <input id="email" type="email" value="someone@example.com" /></label>
    </main>`;
  const redactSnap = fn({ op: 'snapshot' });
  const redactElements = redactSnap.snapshot?.elements ?? [];
  const otpEl = redactElements.find((el) => el.accessibleName === 'One-time code');
  const emailEl = redactElements.find((el) => el.accessibleName === 'Email');
  record(
    'redacts one-time-code values',
    otpEl?.value === '••••••' && emailEl?.value === 'someone@example.com',
    `otp: ${otpEl?.value ?? 'missing'} | email: ${emailEl?.value ?? 'missing'}`,
  );

  document.body.innerHTML = `
    <header><nav aria-label="Primary"><a href="#home">Home</a></nav></header>
    <main style="padding: 24px">
      <h1>Product</h1>
      <form aria-label="Delivery">
        <label>Pincode <input id="pin" placeholder="Enter pincode" /></label>
        <button type="button">Check</button>
      </form>
      <div id="shadow-host"></div>
      <iframe id="local-frame" title="Checkout frame"></iframe>
      <div style="height: 1600px"></div>
      <button type="button">Load more</button>
    </main>`;

  let shadowClicks = 0;
  const shadowHost = document.getElementById('shadow-host') as HTMLElement;
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<button type="button">Shadow action</button>';
  shadow.querySelector('button')?.addEventListener('click', () => {
    shadowClicks += 1;
  });

  let frameClicks = 0;
  const frame = document.getElementById('local-frame') as HTMLIFrameElement;
  const frameDoc = frame.contentDocument;
  if (frameDoc) {
    frameDoc.body.innerHTML = `
      <main>
        <h1>Frame heading</h1>
        <button type="button">Frame action</button>
        <input aria-label="Frame email" />
      </main>`;
    frameDoc.querySelector('button')?.addEventListener('click', () => {
      frameClicks += 1;
    });
  }

  const rich = fn({ op: 'snapshot' });
  const a11y = rich.snapshot?.a11yText ?? '';
  const richElements = rich.snapshot?.elements ?? [];
  record(
    'builds an accessibility tree',
    /heading “Product”/.test(a11y) &&
      /form “Delivery”/.test(a11y) &&
      /button “Check”/.test(a11y) &&
      /navigation “Primary”/.test(a11y),
    a11y.slice(0, 220),
  );
  record(
    'includes shadow DOM, frames and offscreen controls in the tree',
    /Shadow action/.test(a11y) && /Frame action/.test(a11y) && /Load more/.test(a11y),
    a11y.slice(-260),
  );

  const shadowFind = fn({ op: 'find', query: 'shadow action' });
  const shadowMatch = shadowFind.find?.[0];
  record(
    'finds a shadow-DOM control',
    !!shadowMatch && shadowFind.ok,
    shadowMatch ? `${shadowMatch.id} ${shadowMatch.name}` : shadowFind.message,
  );
  if (shadowMatch) {
    const res = fn({ op: 'click', elementId: shadowMatch.id });
    record('clicks a shadow-DOM control', res.ok && shadowClicks === 1, res.message);
  } else {
    record('clicks a shadow-DOM control', false, 'target missing');
  }

  const frameFind = fn({ op: 'find', query: 'frame action' });
  const frameMatch = frameFind.find?.[0];
  record(
    'finds a same-origin frame control',
    !!frameMatch && frameFind.ok,
    frameMatch ? `${frameMatch.id} ${frameMatch.name}` : frameFind.message,
  );
  if (frameMatch) {
    const res = fn({ op: 'click', elementId: frameMatch.id });
    record('clicks a same-origin frame control', res.ok && frameClicks === 1, res.message);
  } else {
    record('clicks a same-origin frame control', false, 'target missing');
  }

  const frameEmail = fn({ op: 'find', query: 'frame email' });
  const frameEmailId = frameEmail.find?.[0]?.id;
  const typedFrame = frameEmailId
    ? fn({ op: 'type', elementId: frameEmailId, text: 'a@b.co' })
    : { ok: false, message: 'target missing' };
  record(
    'types into a same-origin frame field',
    typedFrame.ok && frameDoc?.querySelector('input')?.value === 'a@b.co',
    typedFrame.message,
  );

  const offscreen = fn({ op: 'find', query: 'load more' });
  const offscreenMatch = offscreen.find?.[0];
  record(
    'marks offscreen find matches',
    !!offscreenMatch && offscreenMatch.inViewport === false,
    offscreenMatch ? `${offscreenMatch.id} offscreen=${!offscreenMatch.inViewport}` : offscreen.message,
  );
  record(
    'captures offscreen controls in the element registry',
    richElements.some((el) => (el.accessibleName || el.text) === 'Load more' && el.inViewport === false),
    `${richElements.length} elements`,
  );

  finish(checks);
}

function finish(checks: Array<{ name: string; pass: boolean; detail: string }>): void {
  const passed = checks.filter((c) => c.pass).length;
  const ok = passed === checks.length;
  document.title = ok ? `DOMTEST PASS ${passed}/${checks.length}` : `DOMTEST FAIL ${passed}/${checks.length}`;
  const pre = document.createElement('pre');
  pre.id = 'domtest';
  pre.style.cssText = 'font: 12px ui-monospace, monospace; white-space: pre-wrap; padding: 16px;';
  pre.textContent = checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`).join('\n');
  document.body.appendChild(pre);
}
