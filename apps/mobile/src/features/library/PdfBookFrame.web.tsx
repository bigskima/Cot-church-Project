import React from 'react';

export function PdfBookFrame({ url }: { url: string }) {
  return <iframe title='Book PDF' src={url} style={{ width: '100%', height: '78vh', minHeight: 560, border: 0, borderRadius: 16, background: '#fff' }} />;
}
