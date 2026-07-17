/**
 * Parent ↔ preview iframe protocol for Shipboard Browser.
 * Same-origin srcDoc iframes can run live DOM QA without Playwright.
 */

export const ADGEN_QA_REQUEST = "adgen-browser-qa";
export const ADGEN_QA_RESPONSE = "adgen-browser-qa-result";
export const ADGEN_CAPTURE_REQUEST = "adgen-browser-capture";
export const ADGEN_CAPTURE_RESPONSE = "adgen-browser-capture-result";

export interface LiveQaPayload {
  rootEmpty: boolean;
  consoleErrors: string[];
  buttonCount: number;
  linkCount: number;
  hasH1: boolean;
  h1Text: string;
  textLength: number;
  title: string;
}

export interface LiveCapturePayload {
  ok: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

/** Snippet injected into preview HTML (runs inside iframe). */
export function getPreviewBridgeScript(): string {
  return `
(function () {
  if (window.__adgenBrowserBridge) return;
  window.__adgenBrowserBridge = true;
  window.__adgenConsoleErrors = window.__adgenConsoleErrors || [];

  var origErr = window.onerror;
  window.addEventListener('error', function (e) {
    try {
      window.__adgenConsoleErrors.push(String(e.message || e.error || 'error'));
      if (window.__adgenConsoleErrors.length > 20) window.__adgenConsoleErrors.shift();
    } catch (_) {}
  });

  function liveQa() {
    var root = document.getElementById('root');
    var errEl = document.getElementById('adgen-error');
    var errVisible = errEl && errEl.style.display !== 'none' && errEl.textContent;
    var errors = (window.__adgenConsoleErrors || []).slice();
    if (errVisible) errors.push(String(errEl.textContent).slice(0, 200));
    var h1 = document.querySelector('h1');
    return {
      rootEmpty: !root || root.childElementCount === 0,
      consoleErrors: errors,
      buttonCount: document.querySelectorAll('button').length,
      linkCount: document.querySelectorAll('a').length,
      hasH1: !!h1,
      h1Text: h1 ? (h1.textContent || '').slice(0, 120) : '',
      textLength: (document.body && document.body.innerText || '').trim().length,
      title: document.title || ''
    };
  }

  function captureViewport() {
    return new Promise(function (resolve) {
      try {
        // Compact thumbnail size for version strip (storage-friendly)
        var tw = 320;
        var th = 180;
        var canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ ok: false, error: 'no canvas' });
          return;
        }
        var bg = getComputedStyle(document.body).backgroundColor || '#09090b';
        var fg = getComputedStyle(document.body).color || '#fafafa';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, tw, th);

        // Paint colored blocks from major layout elements (visual fingerprint)
        var nodes = document.querySelectorAll('header, nav, main, section, footer, [class*="hero"], [class*="card"], button, a');
        var painted = 0;
        for (var i = 0; i < nodes.length && painted < 28; i++) {
          var el = nodes[i];
          if (!el || el.nodeType !== 1 || typeof el.getBoundingClientRect !== 'function') continue;
          var r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          var cs = getComputedStyle(el);
          var fill = cs.backgroundColor;
          if (!fill || fill === 'transparent' || fill === 'rgba(0, 0, 0, 0)') {
            fill = cs.borderColor || fg;
          }
          var sx = Math.max(0, r.left / (window.innerWidth || 1) * tw);
          var sy = Math.max(0, r.top / (window.innerHeight || 1) * th);
          var sw = Math.max(2, r.width / (window.innerWidth || 1) * tw);
          var sh = Math.max(2, r.height / (window.innerHeight || 1) * th);
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = fill;
          ctx.fillRect(sx, sy, Math.min(sw, tw - sx), Math.min(sh, th - sy));
          painted++;
        }
        ctx.globalAlpha = 1;

        // Title overlay
        var h1 = document.querySelector('h1');
        var label = h1 ? (h1.textContent || '').trim() : (document.body.innerText || '').trim().split('\\n')[0] || '';
        if (label) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(0, th - 36, tw, 36);
          ctx.fillStyle = '#fafafa';
          ctx.font = 'bold 12px system-ui,sans-serif';
          ctx.fillText(label.slice(0, 42), 8, th - 14);
        }

        // Downscale further for storage
        var out = document.createElement('canvas');
        out.width = 160;
        out.height = 90;
        var octx = out.getContext('2d');
        if (octx) {
          octx.drawImage(canvas, 0, 0, 160, 90);
          resolve({ ok: true, dataUrl: out.toDataURL('image/jpeg', 0.72), width: 160, height: 90 });
        } else {
          resolve({ ok: true, dataUrl: canvas.toDataURL('image/jpeg', 0.72), width: tw, height: th });
        }
      } catch (e) {
        resolve({ ok: false, error: String(e && e.message || e) });
      }
    });
  }

  window.addEventListener('message', function (ev) {
    var data = ev.data;
    if (!data || !data.type) return;
    if (data.type === '${ADGEN_QA_REQUEST}') {
      var qa = liveQa();
      parent.postMessage({ type: '${ADGEN_QA_RESPONSE}', id: data.id, payload: qa }, '*');
    }
    if (data.type === '${ADGEN_CAPTURE_REQUEST}') {
      captureViewport().then(function (cap) {
        parent.postMessage({ type: '${ADGEN_CAPTURE_RESPONSE}', id: data.id, payload: cap }, '*');
      });
    }
  });
})();
`.trim();
}

export function requestLiveQa(
  iframe: HTMLIFrameElement,
  timeoutMs = 2500
): Promise<LiveQaPayload | null> {
  return new Promise((resolve) => {
    const id = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve(null);
    }, timeoutMs);

    function onMsg(ev: MessageEvent) {
      const data = ev.data;
      if (!data || data.type !== ADGEN_QA_RESPONSE || data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(data.payload as LiveQaPayload);
    }

    window.addEventListener("message", onMsg);
    try {
      iframe.contentWindow?.postMessage({ type: ADGEN_QA_REQUEST, id }, "*");
    } catch {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(null);
    }
  });
}

export function requestLiveCapture(
  iframe: HTMLIFrameElement,
  timeoutMs = 3000
): Promise<LiveCapturePayload | null> {
  return new Promise((resolve) => {
    const id = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve(null);
    }, timeoutMs);

    function onMsg(ev: MessageEvent) {
      const data = ev.data;
      if (!data || data.type !== ADGEN_CAPTURE_RESPONSE || data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(data.payload as LiveCapturePayload);
    }

    window.addEventListener("message", onMsg);
    try {
      iframe.contentWindow?.postMessage({ type: ADGEN_CAPTURE_REQUEST, id }, "*");
    } catch {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(null);
    }
  });
}
