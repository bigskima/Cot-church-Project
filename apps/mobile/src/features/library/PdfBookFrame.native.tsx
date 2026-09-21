import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Speech from 'expo-speech';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { pdfViewerHtml } from './pdf-viewer-html';

type PdfReaderMessage =
  | { type: 'pdf-read-page'; text?: string; rate?: number }
  | { type: 'pdf-stop-reading' }
  | { type: 'pdf-rate-change'; rate?: number };

const VALID_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function splitSpeechText(value: string) {
  const maximum = Math.max(600, Math.min(Number(Speech.maxSpeechInputLength) || 3000, 3000));
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [value];
  const chunks: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > maximum) {
      push();
      const words = sentence.split(/\s+/);
      for (const word of words) {
        if (current && current.length + word.length + 1 > maximum) push();
        current += `${current ? ' ' : ''}${word}`;
      }
      push();
      continue;
    }
    if (!current) current = sentence;
    else if (current.length + sentence.length + 1 <= maximum) current += ` ${sentence}`;
    else {
      push();
      current = sentence;
    }
  }
  push();
  return chunks;
}

export function PdfBookFrame({
  url,
  speechRate = 1,
  onSpeechRateChange,
}: {
  url: string;
  speechRate?: number;
  onSpeechRateChange?: (rate: any) => void;
}) {
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
  const speechRun = useRef(0);
  // Do not rebuild the whole PDF iframe/WebView just because the user changes
  // speed. The reader reports the selected speed with each speech request.
  const html = useMemo(() => pdfViewerHtml(url, speechRate), [url]);

  useEffect(() => () => {
    speechRun.current += 1;
    void Speech.stop();
  }, []);

  const notifySpeechDone = () => {
    webViewRef.current?.injectJavaScript(
      'window.__cotPdfSpeechDone && window.__cotPdfSpeechDone(); true;',
    );
  };

  const stopSpeech = () => {
    speechRun.current += 1;
    void Speech.stop();
  };

  const speakPage = async (text: string, requestedRate?: number) => {
    const chunks = splitSpeechText(text.trim());
    if (!chunks.length) return;

    speechRun.current += 1;
    const run = speechRun.current;
    await Speech.stop();
    if (run !== speechRun.current) return;

    const rate = VALID_RATES.includes(Number(requestedRate)) ? Number(requestedRate) : speechRate;

    const speakChunk = (index: number) => {
      if (run !== speechRun.current) return;
      if (index >= chunks.length) {
        notifySpeechDone();
        return;
      }
      Speech.speak(chunks[index], {
        rate,
        onDone: () => {
          if (run === speechRun.current) speakChunk(index + 1);
        },
        onStopped: () => {
          // Explicit stop/page changes increment speechRun before stopping, so
          // an old callback can never accidentally advance Auto read.
          if (run === speechRun.current) notifySpeechDone();
        },
        onError: () => {
          if (run === speechRun.current) notifySpeechDone();
        },
      });
    };

    speakChunk(0);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as PdfReaderMessage;
      if (message.type === 'pdf-stop-reading') {
        stopSpeech();
        return;
      }
      if (message.type === 'pdf-rate-change') {
        const next = Number(message.rate);
        if (VALID_RATES.includes(next)) onSpeechRateChange?.(next);
        return;
      }
      if (message.type === 'pdf-read-page' && message.text?.trim()) {
        void speakPage(message.text, message.rate);
      }
    } catch {
      // Ignore non-reader WebView messages.
    }
  };

  return (
    <View style={styles.frame}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#080d15' },
  web: { flex: 1, backgroundColor: '#080d15' },
});
