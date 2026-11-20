export function pdfViewerHtml(url: string, initialSpeechRate = 1) {
  const source = JSON.stringify(url).replace(/</g, '\\u003c');
  const rate = Number.isFinite(initialSpeechRate) ? Math.min(2, Math.max(0.5, initialSpeechRate)) : 1;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  :root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  *{box-sizing:border-box}
  html,body,#shell{height:100%;margin:0;overflow:hidden}
  body{background:#080d15;color:#eef4ff}
  #shell{display:flex;flex-direction:column}
  #toolbar{z-index:10;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:9px 10px;background:#0b121d;border-bottom:1px solid #223047}
  button,input,select{font:inherit}
  button{border:1px solid #34435b;background:#111a28;color:#eef4ff;border-radius:999px;min-height:38px;padding:0 13px;font-weight:850;cursor:pointer}
  button:disabled{opacity:.38;cursor:default}
  button.primary{background:#168fe8;border-color:#168fe8;color:white}
  button.active{background:#0e3d62;border-color:#168fe8;color:#75c2ff}
  .pagebox{display:flex;align-items:center;gap:5px;color:#9cabc0;font-size:12px;font-weight:850}
  #pageInput{width:56px;height:36px;border-radius:11px;border:1px solid #34435b;background:#0d1522;color:#eef4ff;text-align:center;font-weight:900}
  .speedbox{display:flex;align-items:center;gap:6px;color:#9cabc0;font-size:10px;font-weight:850}
  #speechRate{height:36px;border:1px solid #34435b;border-radius:999px;background:#111a28;color:#eef4ff;padding:0 9px;font-weight:900}
  #zoomLabel{min-width:46px;text-align:center;color:#9cabc0;font-size:11px;font-weight:850}
  #outlineWrap{display:none;border-bottom:1px solid #1e2939;background:#0c131f;padding:8px 10px}
  #outlineTitle{font-size:9.5px;letter-spacing:1px;font-weight:900;color:#7e91aa;margin:0 0 7px}
  #outline{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
  #outline::-webkit-scrollbar{display:none}
  .outlineBtn{white-space:nowrap;min-height:34px;padding:0 11px;background:#111a28;font-size:10px}
  #stage{flex:1;min-height:0;overflow:auto;display:block;padding:14px 8px 26px;overscroll-behavior:contain}
  #paper{width:max-content;max-width:100%;margin:0 auto;background:#fff;box-shadow:0 16px 40px rgba(0,0,0,.28);line-height:0}
  canvas{display:block;max-width:100%;height:auto}
  #status{padding:42px 20px;text-align:center;color:#9cabc0;font-weight:750;line-height:1.5}
  #textStatus{display:none;padding:7px 12px;background:#111a28;border-bottom:1px solid #223047;color:#8fa1b7;font-size:10px;font-weight:750;line-height:1.45}
  #error{display:none;padding:32px 20px;text-align:center;color:#ffd1d6}
  #error a{display:inline-block;margin-top:14px;color:#79b9ff;font-weight:900}
  @media(max-width:560px){
    #toolbar{padding:8px 7px;gap:6px}
    button{min-height:36px;padding:0 10px;font-size:12px}
    .hideSmall{display:none}
    #stage{padding:9px 3px 18px}
    #read,#autoRead{font-size:11px}
    .speedbox span{display:none}
  }
</style>
</head>
<body>
<div id="shell">
  <div id="toolbar">
    <button id="prev">‹ Previous</button>
    <div class="pagebox"><span>Page</span><input id="pageInput" inputmode="numeric" value="1"/><span id="pageTotal">/ —</span></div>
    <button id="next" class="primary">Next ›</button>
    <button id="read">🔊 Read aloud</button>
    <button id="autoRead">▶ Auto read</button>
    <label class="speedbox"><span>Voice speed</span><select id="speechRate" aria-label="Voice speed">
      <option value="0.5">0.5×</option>
      <option value="0.75">0.75×</option>
      <option value="1">1×</option>
      <option value="1.25">1.25×</option>
      <option value="1.5">1.5×</option>
      <option value="2">2×</option>
    </select></label>
    <button id="zoomOut" class="hideSmall">−</button>
    <span id="zoomLabel" class="hideSmall">100%</span>
    <button id="zoomIn" class="hideSmall">+</button>
  </div>
  <div id="textStatus"></div>
  <div id="outlineWrap"><div id="outlineTitle">DOCUMENT SECTIONS</div><div id="outline"></div></div>
  <div id="stage">
    <div id="status">Preparing the book inside COT…</div>
    <div id="paper" style="display:none"><canvas id="canvas"></canvas></div>
    <div id="error">This PDF could not be rendered inside the reader.<br/><a id="openOriginal" href="#" target="_blank" rel="noopener noreferrer">Open original PDF</a></div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
(() => {
  const fileUrl = ${source};
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const textStatus = document.getElementById('textStatus');
  const errorBox = document.getElementById('error');
  const paper = document.getElementById('paper');
  const canvas = document.getElementById('canvas');
  const pageInput = document.getElementById('pageInput');
  const pageTotal = document.getElementById('pageTotal');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const read = document.getElementById('read');
  const autoReadButton = document.getElementById('autoRead');
  const speechRateSelect = document.getElementById('speechRate');
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomLabel = document.getElementById('zoomLabel');
  const outlineWrap = document.getElementById('outlineWrap');
  const outlineEl = document.getElementById('outline');
  document.getElementById('openOriginal').href = fileUrl;

  let pdf = null;
  let currentPage = 1;
  let currentPageText = '';
  let zoom = 1;
  let renderTask = null;
  let speaking = false;
  let autoRead = false;
  let browserSpeechRun = 0;
  let speechRate = normalizeRate(${rate});

  function normalizeRate(value) {
    const number = Number(value);
    return [0.5,0.75,1,1.25,1.5,2].includes(number) ? number : 1;
  }

  speechRateSelect.value = String(speechRate);

  function updateReadButtons() {
    const hasText = Boolean(currentPageText.trim());
    read.disabled = !hasText;
    autoReadButton.disabled = !hasText;
    read.textContent = speaking ? '■ Stop' : '🔊 Read aloud';
    autoReadButton.textContent = autoRead ? '■ Auto reading' : '▶ Auto read';
    autoReadButton.classList.toggle('active', autoRead);
  }

  function nativeMessage(payload) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  function notifyHostRate() {
    const payload = { type: 'pdf-rate-change', rate: speechRate };
    if (nativeMessage(payload)) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'cot-pdf-reader', ...payload }, '*');
    }
  }

  function stopSpeech(keepAuto = false) {
    if (!keepAuto) autoRead = false;
    speaking = false;
    browserSpeechRun += 1;
    if (!nativeMessage({ type: 'pdf-stop-reading' }) && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    updateReadButtons();
  }

  window.__cotPdfSpeechDone = function () {
    speaking = false;
    updateReadButtons();
    if (autoRead && pdf && currentPage < pdf.numPages) {
      currentPage += 1;
      render(true);
    } else if (autoRead) {
      autoRead = false;
      updateReadButtons();
    }
  };

  function isNoiseLine(value) {
    const line = String(value || '').replace(/\s+/g, ' ').trim();
    if (!line) return true;
    if (/^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i.test(line)) return true;
    if (/^(?:[•·◆◇▪▫■□●○❖✦✧★☆*_=~—–\-\s]){3,}$/.test(line)) return true;
    return false;
  }

  function joinLineItems(items) {
    const ordered = items.slice().sort((a, b) => a.x - b.x);
    let text = '';
    let right = null;
    let previousFont = 10;
    for (const item of ordered) {
      const raw = String(item.text || '').replace(/\s+/g, ' ').trim();
      if (!raw) continue;
      const gap = right === null ? 0 : item.x - right;
      const needsSpace = Boolean(text) && gap > Math.max(1.2, Math.min(previousFont, item.fontSize) * 0.12)
        && !/[-‐‑\/(]$/.test(text)
        && !/^[,.;:!?%)\]}]/.test(raw);
      if (needsSpace) text += ' ';
      text += raw;
      right = Math.max(right === null ? item.x : right, item.x + Math.max(0, item.width || 0));
      previousFont = item.fontSize || previousFont;
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  function extractReadableText(page, textContent) {
    const rawItems = (textContent && textContent.items || []).map((item, index) => {
      const transform = item && item.transform || [1,0,0,1,0,0];
      const fontSize = Math.max(1, Math.abs(Number(transform[3]) || Number(item.height) || 10));
      return {
        index,
        text: item && item.str || '',
        x: Number(transform[4]) || 0,
        y: Number(transform[5]) || 0,
        width: Number(item && item.width) || 0,
        fontSize,
        hasEOL: Boolean(item && item.hasEOL),
      };
    }).filter((item) => item.text && item.text.trim());

    if (!rawItems.length) return '';

    const pageHeight = Math.max(1, Number(page.view && (page.view[3] - page.view[1])) || 1);
    const mainItems = rawItems.filter((item) => (
      item.fontSize >= 5
      && item.y >= pageHeight * 0.055
      && item.y <= pageHeight * 0.945
    ));
    const candidates = mainItems.length >= Math.min(4, rawItems.length) ? mainItems : rawItems;

    const ordered = candidates.slice().sort((a, b) => {
      if (Math.abs(a.y - b.y) > 2.5) return b.y - a.y;
      return a.x - b.x;
    });

    const lines = [];
    for (const item of ordered) {
      const tolerance = Math.max(2.5, Math.min(7, item.fontSize * 0.42));
      let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (!line) {
        line = { y: item.y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    }
    lines.sort((a, b) => b.y - a.y);

    const textLines = [];
    const seen = new Set();
    for (const line of lines) {
      const value = joinLineItems(line.items);
      const key = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!value || isNoiseLine(value) || !key || seen.has(key)) continue;
      seen.add(key);
      textLines.push(value);
    }

    let result = '';
    for (const line of textLines) {
      if (result && /[A-Za-z][-‐‑]$/.test(result) && /^[a-z]/.test(line)) {
        result = result.replace(/[-‐‑]$/, '') + line;
      } else {
        result += (result ? '\n' : '') + line;
      }
    }

    return result
      .replace(/([A-Za-z])[-‐‑]\s*\n\s*([a-z])/g, '$1$2')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitSpeechText(value, maximum = 2200) {
    const sentences = String(value || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [value];
    const chunks = [];
    let current = '';
    const push = () => {
      if (current.trim()) chunks.push(current.trim());
      current = '';
    };

    for (const rawSentence of sentences) {
      const sentence = String(rawSentence || '').trim();
      if (!sentence) continue;
      if (sentence.length > maximum) {
        push();
        for (const word of sentence.split(/\s+/)) {
          if (current && current.length + word.length + 1 > maximum) push();
          current += (current ? ' ' : '') + word;
        }
        push();
        continue;
      }
      if (!current) current = sentence;
      else if (current.length + sentence.length + 1 <= maximum) current += ' ' + sentence;
      else {
        push();
        current = sentence;
      }
    }
    push();
    return chunks;
  }

  function speakCurrent(continuous = false) {
    if (!currentPageText.trim()) return;
    if (speaking) {
      stopSpeech();
      return;
    }
    autoRead = continuous;
    speaking = true;
    updateReadButtons();

    if (nativeMessage({ type: 'pdf-read-page', text: currentPageText, page: currentPage, continuous, rate: speechRate })) return;

    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      speaking = false;
      autoRead = false;
      textStatus.style.display = 'block';
      textStatus.textContent = 'Read aloud is not supported by this browser.';
      updateReadButtons();
      return;
    }

    const chunks = splitSpeechText(currentPageText);
    const run = ++browserSpeechRun;
    window.speechSynthesis.cancel();

    const speakChunk = (index) => {
      if (run !== browserSpeechRun) return;
      if (index >= chunks.length) {
        window.__cotPdfSpeechDone();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = speechRate;
      utterance.onend = () => {
        if (run === browserSpeechRun) speakChunk(index + 1);
      };
      utterance.onerror = () => {
        if (run !== browserSpeechRun) return;
        speaking = false;
        autoRead = false;
        updateReadButtons();
      };
      window.speechSynthesis.speak(utterance);
    };

    speakChunk(0);
  }

  function fail(message) {
    stopSpeech();
    status.style.display = 'none';
    paper.style.display = 'none';
    errorBox.style.display = 'block';
    if (message) errorBox.firstChild.textContent = message;
  }

  async function render(readAfterRender = false) {
    if (!pdf) return;
    currentPage = Math.max(1, Math.min(pdf.numPages, currentPage));
    pageInput.value = String(currentPage);
    pageTotal.textContent = '/ ' + pdf.numPages;
    prev.disabled = currentPage <= 1;
    next.disabled = currentPage >= pdf.numPages;
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    status.style.display = 'block';
    status.textContent = 'Loading page ' + currentPage + '…';
    textStatus.style.display = 'none';
    currentPageText = '';
    updateReadButtons();

    try {
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) {}
        renderTask = null;
      }
      const page = await pdf.getPage(currentPage);
      const base = page.getViewport({ scale: 1 });
      const available = Math.max(280, Math.min(900, stage.clientWidth - 10));
      const fitScale = available / base.width;
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const textPromise = page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false }).catch(() => null);
      renderTask = page.render({ canvasContext: ctx, viewport });
      const [, textContent] = await Promise.all([renderTask.promise, textPromise]);
      renderTask = null;

      currentPageText = textContent ? extractReadableText(page, textContent) : '';

      status.style.display = 'none';
      paper.style.display = 'block';
      stage.scrollTop = 0;

      if (!currentPageText) {
        textStatus.style.display = 'block';
        textStatus.textContent = 'This page has no reliable readable text. Decorative PDF objects are ignored; scanned pages need OCR before read aloud can work.';
      }
      updateReadButtons();
      if ((readAfterRender || autoRead) && currentPageText) speakCurrent(true);
    } catch (err) {
      if (err && err.name === 'RenderingCancelledException') return;
      fail('Unable to render this PDF page inside COT.');
    }
  }

  async function destinationPage(dest) {
    try {
      const resolved = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
      if (!resolved || !resolved[0]) return null;
      if (typeof resolved[0] === 'number') return resolved[0] + 1;
      return (await pdf.getPageIndex(resolved[0])) + 1;
    } catch (_) {
      return null;
    }
  }

  async function buildOutline(items, depth = 0) {
    for (const item of items || []) {
      const pageNumber = await destinationPage(item.dest);
      if (pageNumber) {
        const button = document.createElement('button');
        button.className = 'outlineBtn';
        button.textContent = (depth ? '› ' : '') + (item.title || ('Page ' + pageNumber));
        button.onclick = () => { stopSpeech(); currentPage = pageNumber; render(); };
        outlineEl.appendChild(button);
      }
      if (item.items && item.items.length) await buildOutline(item.items, depth + 1);
    }
  }

  prev.onclick = () => { if (currentPage > 1) { stopSpeech(); currentPage--; render(); } };
  next.onclick = () => { if (pdf && currentPage < pdf.numPages) { stopSpeech(); currentPage++; render(); } };
  read.onclick = () => speakCurrent(false);
  autoReadButton.onclick = () => {
    if (autoRead || speaking) { stopSpeech(); return; }
    speakCurrent(true);
  };
  speechRateSelect.onchange = () => {
    speechRate = normalizeRate(speechRateSelect.value);
    speechRateSelect.value = String(speechRate);
    notifyHostRate();
    if (speaking) stopSpeech();
  };
  pageInput.onchange = () => {
    if (!pdf) return;
    const value = Number(pageInput.value);
    if (Number.isInteger(value)) currentPage = Math.max(1, Math.min(pdf.numPages, value));
    stopSpeech();
    render();
  };
  pageInput.onkeydown = (event) => { if (event.key === 'Enter') pageInput.blur(); };
  zoomIn.onclick = () => { zoom = Math.min(1.8, zoom + 0.15); render(); };
  zoomOut.onclick = () => { zoom = Math.max(0.65, zoom - 0.15); render(); };
  window.addEventListener('resize', () => {
    clearTimeout(window.__cotPdfResize);
    window.__cotPdfResize = setTimeout(() => render(), 180);
  });

  async function start() {
    try {
      if (!window.pdfjsLib) throw new Error('PDF reader failed to load.');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
      const outline = await pdf.getOutline();
      if (outline && outline.length) {
        await buildOutline(outline);
        if (outlineEl.children.length) outlineWrap.style.display = 'block';
      }
      await render();
    } catch (err) {
      fail('This PDF could not be displayed inside COT.');
    }
  }
  start();
})();
</script>
</body>
</html>`;
}
