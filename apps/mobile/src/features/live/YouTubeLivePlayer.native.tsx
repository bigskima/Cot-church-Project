import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export function YouTubeLivePlayer({ videoId }: { videoId: string }) {
  const uri = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?playsinline=1&autoplay=1&rel=0`;
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  webview: { flex: 1, backgroundColor: '#000000' },
});
