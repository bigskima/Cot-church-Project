import React, { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import type { AgoraLiveSessionProps } from './agora-types';

export function AgoraLiveSession({ grant, role, onJoined, onLeave, onError }: AgoraLiveSessionProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const hostId = useMemo(() => `agora-host-${grant.channelName}-${grant.uid}`.replace(/[^a-zA-Z0-9_-]/g, ''), [grant.channelName, grant.uid]);
  const remoteId = useMemo(() => `agora-remote-${grant.channelName}-${grant.uid}`.replace(/[^a-zA-Z0-9_-]/g, ''), [grant.channelName, grant.uid]);
  const [message, setMessage] = useState(role === 'publisher' ? 'Preparing camera…' : 'Joining live service…');

  useEffect(() => {
    let disposed = false;
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    clientRef.current = client;

    const reportError = (value: unknown) => {
      const text = value instanceof Error ? value.message : 'Unable to join the Expression live session.';
      if (!disposed) setMessage(text);
      onError?.(text);
    };

    client.on('user-published', async (user, mediaType) => {
      if (role !== 'subscriber' || disposed) return;
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          user.videoTrack?.play(remoteId);
          setMessage('Watching live.');
        } else {
          user.audioTrack?.play();
        }
      } catch (value) {
        reportError(value);
      }
    });
    client.on('user-unpublished', (_user, mediaType) => {
      if (role === 'subscriber' && mediaType === 'video' && !disposed) {
        setMessage('The broadcaster paused video. Waiting for the live service…');
      }
    });

    const start = async () => {
      try {
        await client.setClientRole(role === 'publisher' ? 'host' : 'audience');
        await client.join(grant.appId, grant.channelName, grant.token, grant.uid);
        if (disposed) return;

        if (role === 'publisher') {
          const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
          if (disposed) {
            audio.close();
            video.close();
            return;
          }
          localAudioRef.current = audio;
          localVideoRef.current = video;
          video.play(hostId);
          await client.publish([audio, video]);
          setMessage('You are live in this Expression.');
        } else {
          setMessage('Connected. Waiting for the broadcaster…');
        }
        onJoined?.();
      } catch (value) {
        reportError(value);
      }
    };

    void start();
    return () => {
      disposed = true;
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      localAudioRef.current = null;
      localVideoRef.current = null;
      void client.leave().catch(() => {});
      client.removeAllListeners();
      clientRef.current = null;
      onLeave?.();
    };
  }, [grant.appId, grant.channelName, grant.token, grant.uid, hostId, onError, onJoined, onLeave, remoteId, role]);

  return React.createElement(
    'div',
    { style: { position: 'relative', width: '100%', height: '100%', minHeight: 220, background: '#000', overflow: 'hidden' } },
    React.createElement('div', {
      id: role === 'publisher' ? hostId : remoteId,
      style: { position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' },
    }),
    React.createElement(
      'div',
      { style: { position: 'absolute', left: 12, bottom: 12, right: 12, color: '#fff', fontSize: 12, textShadow: '0 1px 2px #000' } },
      message,
    ),
  );
}
