import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export function PdfBookFrame({ url }: { url: string }) {
  return <View style={styles.frame}><WebView source={{ uri: url }} style={styles.web} startInLoadingState /></View>;
}
const styles = StyleSheet.create({ frame: { flex: 1, minHeight: 560, overflow: 'hidden', borderRadius: 16 }, web: { flex: 1 } });
