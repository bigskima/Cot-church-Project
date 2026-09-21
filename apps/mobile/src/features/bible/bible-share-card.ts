export function bibleVerseCardDataUri(input: { reference: string; text: string; version?: string }) {
  const escapeXml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const words = input.text.trim().split(/\s+/);
  const wrapped: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length <= 44) line = next;
    else {
      if (line) wrapped.push(line);
      line = word;
    }
    if (wrapped.length >= 8) break;
  }
  if (line && wrapped.length < 9) wrapped.push(line);

  const textLines = wrapped
    .map((item, index) =>
      '<text x="70" y="' + (210 + index * 54) + '" font-size="34" font-family="Arial, sans-serif" fill="#f7f9fc">' +
      escapeXml(item) +
      '</text>',
    )
    .join('');

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07111f"/><stop offset="1" stop-color="#102947"/></linearGradient></defs>' +
    '<rect width="1080" height="1080" fill="url(#bg)"/>' +
    '<circle cx="875" cy="185" r="150" fill="#1597ef" opacity=".12"/>' +
    '<text x="70" y="100" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#28a7ff">CITY OF TRANSFORMATION</text>' +
    '<text x="70" y="158" font-size="22" font-family="Arial, sans-serif" fill="#9eb0c8">SCRIPTURE</text>' +
    textLines +
    '<text x="70" y="890" font-size="40" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">' + escapeXml(input.reference) + '</text>' +
    '<text x="70" y="940" font-size="24" font-family="Arial, sans-serif" fill="#9eb0c8">' + escapeXml(input.version || 'WEB') + '</text>' +
    '<text x="70" y="1010" font-size="20" font-family="Arial, sans-serif" fill="#71839b">Shared from COT Bible</text>' +
    '</svg>';

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
