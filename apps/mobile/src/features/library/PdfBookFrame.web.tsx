import React from 'react';
import { pdfViewerHtml } from './pdf-viewer-html';

export function PdfBookFrame({ url }: { url: string }) {
  return (
    <iframe
      title="COT PDF reader"
      srcDoc={pdfViewerHtml(url)}
      sandbox="allow-scripts allow-same-origin allow-popups"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        border: 0,
        background: '#080d15',
      }}
    />
  );
}
