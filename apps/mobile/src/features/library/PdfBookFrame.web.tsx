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
        height: '82vh',
        minHeight: 620,
        border: 0,
        borderRadius: 16,
        background: '#090e16',
      }}
    />
  );
}
