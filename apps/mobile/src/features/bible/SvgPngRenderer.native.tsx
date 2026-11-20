import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

export type SvgPngRendererHandle = {
  render: (svgDataUri: string) => Promise<string>;
};

type Job = { id: number; svgDataUri: string } | null;
type Pending = {
  id: number;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
} | null;

function htmlFor(job: NonNullable<Job>) {
  const source = JSON.stringify(job.svgDataUri);
  const jobId = JSON.stringify(job.id);
  return `<!doctype html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:transparent;overflow:hidden">
<canvas id="card" width="1080" height="1080"></canvas>
<script>
(function () {
  const source = ${source};
  const jobId = ${jobId};
  const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  try {
    const canvas = document.getElementById('card');
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.onload = function () {
      try {
        ctx.clearRect(0, 0, 1080, 1080);
        ctx.drawImage(image, 0, 0, 1080, 1080);
        post({ type: 'png', jobId: jobId, data: canvas.toDataURL('image/png', 0.94) });
      } catch (error) {
        post({ type: 'error', jobId: jobId, message: String(error && error.message || error) });
      }
    };
    image.onerror = function () {
      post({ type: 'error', jobId: jobId, message: 'The Scripture card could not be rasterized.' });
    };
    image.src = source;
  } catch (error) {
    post({ type: 'error', jobId: jobId, message: String(error && error.message || error) });
  }
})();
</script>
</body>
</html>`;
}

export const SvgPngRenderer = forwardRef<SvgPngRendererHandle>(function SvgPngRenderer(_, ref) {
  const sequence = useRef(0);
  const pending = useRef<Pending>(null);
  const [job, setJob] = useState<Job>(null);

  const settle = (id: number, value?: string, error?: Error) => {
    const active = pending.current;
    if (!active || active.id !== id) return;
    clearTimeout(active.timer);
    pending.current = null;
    setJob(null);
    if (error) active.reject(error);
    else active.resolve(value || '');
  };

  useImperativeHandle(ref, () => ({
    render(svgDataUri: string) {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.reject(new Error('A newer Scripture card replaced the previous render.'));
        pending.current = null;
      }

      const id = ++sequence.current;
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          settle(id, undefined, new Error('The Scripture card took too long to prepare.'));
        }, 12000);
        pending.current = { id, resolve, reject, timer };
        setJob({ id, svgDataUri });
      });
    },
  }), []);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}') as { type?: string; jobId?: number; data?: string; message?: string };
      if (typeof payload.jobId !== 'number') return;
      if (payload.type === 'png' && typeof payload.data === 'string' && payload.data.startsWith('data:image/png')) {
        settle(payload.jobId, payload.data);
        return;
      }
      if (payload.type === 'error') {
        settle(payload.jobId, undefined, new Error(payload.message || 'Unable to prepare the Scripture card.'));
      }
    } catch {
      const id = pending.current?.id;
      if (id) settle(id, undefined, new Error('Unable to read the generated Scripture card.'));
    }
  };

  if (!job) return null;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }}>
      <WebView
        key={job.id}
        source={{ html: htmlFor(job) }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        onMessage={onMessage}
        onError={() => settle(job.id, undefined, new Error('Unable to start the Scripture card renderer.'))}
        style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
});
