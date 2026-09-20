import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Speech from 'expo-speech';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { pdfViewerHtml } from './pdf-viewer-html';

type PdfReaderMessage =
  | { type: 'pdf-read-page'; text?: string }
  | { type: 'pdf-stop-reading' };

export function PdfBookFrame({ url }: { url: string }) {
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);

  useEffect(() => () => { void Speech.stop(); }, []);

  const notifySpeechDone = () => {
    webViewRef.current?.injectJavaScript(
      'window.__cotPdfSpeechDone && window.__cotPdfSpeechDone(); true;',
    );
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as PdfReaderMessage;
      if (message.type === 'pdf-stop-reading') {
        void Speech.stop();
        return;
      }
      if (message.type === 'pdf-read-page' && message.text?.trim()) {
        void Speech.stop().then(() => {
          Speech.speak(message.text!.trim(), {
            rate: 0.92,
            onDone: notifySpeechDone,
            onStopped: notifySpeechDone,
            onError: notifySpeechDone,
          });
        });
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
        source={{ html: pdfViewerHtml(url) }}
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
