import React from 'react';
import { View } from 'react-native';

export function YouTubeLivePlayer({ videoId }: { videoId: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {React.createElement('iframe', {
        src: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?playsinline=1&autoplay=1&rel=0`,
        title: 'COT YouTube Live',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullScreen: true,
        style: { width: '100%', height: '100%', border: 0, display: 'block' },
      })}
    </View>
  );
}
