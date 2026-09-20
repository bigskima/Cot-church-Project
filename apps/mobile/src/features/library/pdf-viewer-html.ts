export function pdfViewerHtml(url: string) {
  const source = JSON.stringify(url).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
<style>
  :root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  *{box-sizing:border-box}
  body{margin:0;background:#090e16;color:#eef4ff}
  #shell{min-height:100vh;display:flex;flex-direction:column}
  #toolbar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;background:rgba(9,14,22,.96);border-bottom:1px solid #253044}
  button,input{font:inherit}
  button{border:1px solid #34435b;background:#111a28;color:#eef4ff;border-radius:999px;min-height:38px;padding:0 13px;font-weight:800;cursor:pointer}
  button:disabled{opacity:.4;cursor:default}
  button.primary{background:#178fe8;border-color:#178fe8;color:white}
  .pagebox{display:flex;align-items:center;gap:5px;color:#9cabc0;font-size:12px;font-weight:800}
  #pageInput{width:58px;height:36px;border-radius:10px;border:1px solid #34435b;background:#0d1522;color:#eef4ff;text-align:center}
  #zoomLabel{min-width:46px;text-align:center;color:#9cabc0;font-size:11px;font-weight:800}
  #outlineWrap{display:none;border-bottom:1px solid #1e2939;background:#0c131f;padding:8px 10px}
  #outlineTitle{font-size:10px;letter-spacing:.9px;font-weight:900;color:#7e91aa;margin:0 0 7px}
  #outline{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
  .outlineBtn{white-space:nowrap;min-height:34px;padding:0 11px;background:#111a28;font-size:10px}
  #stage{flex:1;display:flex;justify-content:center;align-items:flex-start;padding:16px 10px 28px;overflow:auto}
  #paper{background:#fff;box-shadow:0 16px 40px rgba(0,0,0,.28);line-height:0;max-width:100%}
  canvas{display:block;max-width:100%;height:auto}
  #status{padding:42px 20px;text-align:center;color:#9cabc0;font-weight:700;line-height:1.5}
  #error{display:none;padding:32px 20px;text-align:center;color:#ffd1d6}
  #error a{display:inline-block;margin-top:14px;color:#79b9ff;font-weight:900}
  @media(max-width:560px){#toolbar{padding:8px}.hideSmall{display:none}button{min-height:36px;padding:0 11px}#stage{padding:10px 4px 22px}}
</style>
</head>
<body>
<div id="shell">
  <div id="toolbar">
    <button id="prev">‹ Previous</button>
    <div class="pagebox"><span>Page</span><input id="pageInput" inputmode="numeric" value="1"/><span id="pageTotal">/ —</span></div>
    <button id="next" class="primary">Next ›</button>
    <button id="zoomOut" class="hideSmall">−</button>
    <span id="zoomLabel" class="hideSmall">100%</span>
    <button id="zoomIn" class="hideSmall">+</button>
  </div>
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
  const status = document.getElementById('status');
  const errorBox = document.getElementById('error');
  const paper = document.getElementById('paper');
  const canvas = document.getElementById('canvas');
  const pageInput = document.getElementById('pageInput');
  const pageTotal = document.getElementById('pageTotal');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomLabel = document.getElementById('zoomLabel');
  const outlineWrap = document.getElementById('outlineWrap');
  const outlineEl = document.getElementById('outline');
  document.getElementById('openOriginal').href = fileUrl;
  let pdf = null;
  let currentPage = 1;
  let zoom = 1;
  let renderTask = null;

  function fail(message) {
    status.style.display = 'none';
    paper.style.display = 'none';
    errorBox.style.display = 'block';
    if (message) errorBox.firstChild.textContent = message;
  }

  async function render() {
    if (!pdf) return;
    currentPage = Math.max(1, Math.min(pdf.numPages, currentPage));
    pageInput.value = String(currentPage);
    pageTotal.textContent = '/ ' + pdf.numPages;
    prev.disabled = currentPage <= 1;
    next.disabled = currentPage >= pdf.numPages;
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    status.style.display = 'block';
    status.textContent = 'Loading page ' + currentPage + '…';
    try {
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) {}
        renderTask = null;
      }
      const page = await pdf.getPage(currentPage);
      const base = page.getViewport({ scale: 1 });
      const available = Math.max(280, Math.min(900, document.documentElement.clientWidth - 20));
      const fitScale = available / base.width;
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      renderTask = null;
      status.style.display = 'none';
      paper.style.display = 'block';
      paper.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
        button.onclick = () => { currentPage = pageNumber; render(); };
        outlineEl.appendChild(button);
      }
      if (item.items && item.items.length) await buildOutline(item.items, depth + 1);
    }
  }

  prev.onclick = () => { if (currentPage > 1) { currentPage--; render(); } };
  next.onclick = () => { if (pdf && currentPage < pdf.numPages) { currentPage++; render(); } };
  pageInput.onchange = () => {
    if (!pdf) return;
    const value = Number(pageInput.value);
    if (Number.isInteger(value)) currentPage = Math.max(1, Math.min(pdf.numPages, value));
    render();
  };
  pageInput.onkeydown = (event) => { if (event.key === 'Enter') { pageInput.blur(); } };
  zoomIn.onclick = () => { zoom = Math.min(1.8, zoom + 0.15); render(); };
  zoomOut.onclick = () => { zoom = Math.max(0.65, zoom - 0.15); render(); };
  window.addEventListener('resize', () => { clearTimeout(window.__cotPdfResize); window.__cotPdfResize = setTimeout(render, 180); });

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
