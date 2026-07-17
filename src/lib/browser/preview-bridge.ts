/**
 * Parent ↔ preview iframe protocol for AdGen Browser.
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
        var w = Math.min(window.innerWidth || 800, 1200);
        var h = Math.min(window.innerHeight || 600, 900);
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ ok: false, error: 'no canvas' });
          return;
        }
        // Fallback solid fill + text snapshot (no external html2canvas dep)
        var bg = getComputedStyle(document.body).backgroundColor || '#09090b';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = getComputedStyle(document.body).color || '#fafafa';
        ctx.font = '14px system-ui,sans-serif';
        var text = (document.body.innerText || '').trim().slice(0, 800);
        var lines = text.split(/\\n/).slice(0, 40);
        var y = 24;
        for (var i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i].slice(0, 100), 16, y);
          y += 18;
          if (y > h - 20) break;
        }
        var h1 = document.querySelector('h1');
        if (h1) {
          ctx.font = 'bold 22px system-ui,sans-serif';
          ctx.fillText((h1.textContent || '').slice(0, 60), 16, 28);
        }
        resolve({
          ok: true,
          dataUrl: canvas.toDataURL('image/png'),
          width: w,
          height: h
        });
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
