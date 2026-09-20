import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { pdfViewerHtml } from './pdf-viewer-html';

export function PdfBookFrame({ url }: { url: string }) {
  return (
    <View style={styles.frame}>
      <WebView
        originWhitelist={['*']}
        source={{ html: pdfViewerHtml(url) }}
        style={styles.web}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 680, overflow: 'hidden', borderRadius: 16, backgroundColor: '#090e16' },
  web: { flex: 1, backgroundColor: '#090e16' },
});
