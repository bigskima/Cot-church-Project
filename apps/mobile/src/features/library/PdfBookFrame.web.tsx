import React, { useEffect, useMemo, useRef } from 'react';
import { pdfViewerHtml } from './pdf-viewer-html';

export function PdfBookFrame({
  url,
  speechRate = 1,
  onSpeechRateChange,
}: {
  url: string;
  speechRate?: number;
  onSpeechRateChange?: (rate: any) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => pdfViewerHtml(url, speechRate), [url]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'cot-pdf-reader' || data.type !== 'pdf-rate-change') return;
      const next = Number(data.rate);
      if ([0.5, 0.75, 1, 1.25, 1.5, 2].includes(next)) onSpeechRateChange?.(next);
    };
    globalThis.addEventListener?.('message', handleMessage as any);
    return () => globalThis.removeEventListener?.('message', handleMessage as any);
  }, [onSpeechRateChange]);

  return (
    <iframe
      ref={frameRef}
      title="COT PDF reader"
      srcDoc={html}
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
