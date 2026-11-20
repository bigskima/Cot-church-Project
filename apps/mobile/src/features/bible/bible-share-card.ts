type VerseCardInput = {
  reference: string;
  text: string;
  version?: string;
  logoUrl?: string | null;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapWords(value: string, limit = 38, maxLines = 9) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length <= limit) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export function bibleVerseCardDataUri(input: VerseCardInput) {
  const lines = wrapWords(input.text);
  const quote = lines.map((line, index) =>
    '<text x="76" y="' + (260 + index * 66) + '" font-size="39" font-family="Arial, sans-serif" font-weight="600" fill="#f8fbff">' +
    escapeXml(line) + '</text>'
  ).join('');
  const logo = input.logoUrl
    ? '<image href="' + escapeXml(input.logoUrl) + '" x="76" y="66" width="82" height="82" preserveAspectRatio="xMidYMid slice"/>'
    : '<circle cx="117" cy="107" r="41" fill="#ffffff"/><text x="117" y="119" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" font-weight="900" fill="#178fe8">COT</text>';

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06101d"/><stop offset=".56" stop-color="#0d2038"/><stop offset="1" stop-color="#164367"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#32a8ff" stop-opacity=".3"/><stop offset="1" stop-color="#32a8ff" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="1080" height="1080" rx="72" fill="url(#bg)"/><circle cx="930" cy="150" r="330" fill="url(#glow)"/>' +
    logo +
    '<text x="182" y="96" font-size="28" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">CITY OF TRANSFORMATION</text>' +
    '<text x="182" y="132" font-size="20" font-family="Arial, sans-serif" font-weight="700" letter-spacing="3" fill="#70c7ff">COT BIBLE</text>' +
    '<text x="76" y="224" font-size="80" font-family="Georgia, serif" fill="#32a8ff">“</text>' +
    quote +
    '<line x1="76" y1="866" x2="1004" y2="866" stroke="#ffffff" stroke-opacity=".13"/>' +
    '<text x="76" y="930" font-size="42" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">' + escapeXml(input.reference) + '</text>' +
    '<text x="76" y="974" font-size="23" font-family="Arial, sans-serif" font-weight="700" fill="#9db4c9">' + escapeXml(input.version || 'Bible') + '</text>' +
    '<text x="76" y="1022" font-size="18" font-family="Arial, sans-serif" fill="#7890a7">Read · reflect · share from COT</text>' +
    '</svg>';

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

async function loadBrowserImage(url: string) {
  return new Promise<any>((resolve, reject) => {
    const ImageCtor = (globalThis as any).Image;
    if (!ImageCtor) return reject(new Error('Image rendering is unavailable.'));
    const image = new ImageCtor();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasWrappedText(ctx: any, value: string, maxWidth: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export async function bibleVerseCardPngDataUri(input: VerseCardInput) {
  if (typeof document === 'undefined') return bibleVerseCardDataUri(input);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return bibleVerseCardDataUri(input);

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, '#06101d');
  gradient.addColorStop(0.58, '#0d2038');
  gradient.addColorStop(1, '#164367');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  const glow = ctx.createRadialGradient(900, 120, 10, 900, 120, 360);
  glow.addColorStop(0, 'rgba(50,168,255,.28)');
  glow.addColorStop(1, 'rgba(50,168,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(520, 0, 560, 520);

  let logoDrawn = false;
  if (input.logoUrl) {
    try {
      const logo = await loadBrowserImage(input.logoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(76, 66, 82, 82, 21);
      ctx.clip();
      ctx.drawImage(logo, 76, 66, 82, 82);
      ctx.restore();
      logoDrawn = true;
    } catch {}
  }
  if (!logoDrawn) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(117, 107, 41, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#178fe8';
    ctx.font = '900 25px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('COT', 117, 116);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px Arial';
  ctx.fillText('CITY OF TRANSFORMATION', 182, 96);
  ctx.fillStyle = '#70c7ff';
  ctx.font = '700 20px Arial';
  ctx.fillText('COT BIBLE', 182, 132);

  ctx.fillStyle = '#32a8ff';
  ctx.font = '80px Georgia';
  ctx.fillText('“', 76, 225);

  ctx.fillStyle = '#f8fbff';
  ctx.font = '600 39px Arial';
  const lines = canvasWrappedText(ctx, input.text, 900, 9);
  lines.forEach((line, index) => ctx.fillText(line, 76, 292 + index * 66));

  ctx.strokeStyle = 'rgba(255,255,255,.13)';
  ctx.beginPath();
  ctx.moveTo(76, 866);
  ctx.lineTo(1004, 866);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px Arial';
  ctx.fillText(input.reference, 76, 930);
  ctx.fillStyle = '#9db4c9';
  ctx.font = '700 23px Arial';
  ctx.fillText(input.version || 'Bible', 76, 974);
  ctx.fillStyle = '#7890a7';
  ctx.font = '18px Arial';
  ctx.fillText('Read · reflect · share from COT', 76, 1022);

  return canvas.toDataURL('image/png', 0.94);
}
