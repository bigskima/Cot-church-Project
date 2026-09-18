import React, { useEffect, useRef, useState } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import type { AgoraLiveSessionProps } from './agora-types';

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message?: unknown }).message ?? '');
  return String(value ?? '');
}

function isExpectedTeardownError(value: unknown) {
  const text = errorText(value);
  return /WS_ABORT.*LEAVE|ERR_SUBSCRIBE_REQUEST_INVALID|no such stream id/i.test(text);
}

const controlButtonStyle: React.CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(7,12,20,0.82)',
  color: '#fff',
  minWidth: 54,
  height: 48,
  padding: '0 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  backdropFilter: 'blur(14px)',
};

export function AgoraLiveSession({ grant, role, onJoined, onLeave, onError }: AgoraLiveSessionProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const remoteAudioRef = useRef<{ play: () => void } | null>(null);
  const hostContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteContainerRef = useRef<HTMLDivElement | null>(null);
  const joinedRef = useRef(false);
  const [message, setMessage] = useState(role === 'publisher' ? 'Preparing camera and microphone…' : 'Joining live service…');
  const [joined, setJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [videoHealthy, setVideoHealthy] = useState(false);
  const [networkLabel, setNetworkLabel] = useState('Connecting');

  useEffect(() => {
    let disposed = false;
    let levelTimer: ReturnType<typeof setInterval> | null = null;
    let healthTimer: ReturnType<typeof setInterval> | null = null;
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    clientRef.current = client;

    const agoraAutoplay = AgoraRTC as typeof AgoraRTC & { onAutoplayFailed?: () => void };
    const previousAutoplayHandler = agoraAutoplay.onAutoplayFailed;
    if (role === 'subscriber') {
      agoraAutoplay.onAutoplayFailed = () => {
        if (!disposed) {
          setAudioBlocked(true);
          setMessage('Video connected. Tap Enable sound to hear the service.');
        }
      };
    }

    const reportError = (value: unknown) => {
      if (disposed || isExpectedTeardownError(value)) return;
      const text = errorText(value) || 'Unable to join the Expression live session.';
      setMessage(text);
      onError?.(text);
    };

    client.on('connection-state-change', (currentState) => {
      if (disposed) return;
      if (currentState === 'CONNECTED') setNetworkLabel('Connected');
      else if (currentState === 'RECONNECTING') setNetworkLabel('Reconnecting');
      else if (currentState === 'DISCONNECTED' && joinedRef.current) setNetworkLabel('Disconnected');
    });

    client.on('network-quality', (stats) => {
      if (disposed) return;
      const quality = role === 'publisher' ? stats.uplinkNetworkQuality : stats.downlinkNetworkQuality;
      setNetworkLabel(quality <= 2 ? 'Strong' : quality <= 4 ? 'Fair' : 'Weak');
    });

    client.on('user-published', async (user, mediaType) => {
      if (role !== 'subscriber' || disposed) return;
      try {
        await client.subscribe(user, mediaType);
        if (disposed) return;
        if (mediaType === 'video' && user.videoTrack && remoteContainerRef.current) {
          user.videoTrack.play(remoteContainerRef.current, { fit: 'cover' });
          setMessage('Watching live.');
        } else if (mediaType === 'audio' && user.audioTrack) {
          remoteAudioRef.current = user.audioTrack;
          try {
            user.audioTrack.play();
            setAudioBlocked(false);
          } catch {
            setAudioBlocked(true);
            setMessage('Video connected. Tap Enable sound to hear the service.');
          }
        }
      } catch (value) {
        if (isExpectedTeardownError(value)) {
          if (!disposed) setMessage('The broadcaster has ended the live session.');
          return;
        }
        reportError(value);
      }
    });

    client.on('user-unpublished', (_user, mediaType) => {
      if (role !== 'subscriber' || disposed) return;
      if (mediaType === 'video') setMessage('The broadcaster paused the camera.');
      if (mediaType === 'audio') setMessage('The broadcaster muted the microphone.');
    });

    client.on('user-left', () => {
      if (role === 'subscriber' && !disposed) {
        remoteAudioRef.current = null;
        setAudioBlocked(false);
        setMessage('The broadcaster has left this live session.');
      }
    });

    const start = async () => {
      try {
        await client.setClientRole(role === 'publisher' ? 'host' : 'audience');
        await client.join(grant.appId, grant.channelName, grant.token, grant.uid);
        if (disposed) return;
        joinedRef.current = true;
        setJoined(true);

        if (role === 'publisher') {
          const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { AEC: true, ANS: true, AGC: true },
            { encoderConfig: '480p_1' },
          );
          if (disposed) {
            audio.close();
            video.close();
            return;
          }

          localAudioRef.current = audio;
          localVideoRef.current = video;
          await audio.setMuted(false);
          await video.setMuted(false);

          if (!hostContainerRef.current) {
            throw new Error('Camera preview could not attach to the studio.');
          }
          video.play(hostContainerRef.current, { fit: 'cover', mirror: true });
          await client.publish([audio, video]);
          if (disposed) return;

          const availableCameras = await AgoraRTC.getCameras().catch(() => [] as MediaDeviceInfo[]);
          setCameras(availableCameras);
          const currentTrack = video.getMediaStreamTrack();
          const currentDeviceId = currentTrack.getSettings().deviceId;
          const currentIndex = availableCameras.findIndex((device) => device.deviceId === currentDeviceId);
          if (currentIndex >= 0) setCameraIndex(currentIndex);

          levelTimer = setInterval(() => {
            const track = localAudioRef.current;
            if (!track || disposed) return;
            const level = Math.max(0, Math.min(1, track.getVolumeLevel()));
            setMicLevel(level);
          }, 300);

          healthTimer = setInterval(() => {
            const stats = (localVideoRef.current as unknown as { getStats?: () => { sendFrameRate?: number; captureFrameRate?: number } } | null)?.getStats?.();
            if (!stats || disposed) return;
            setVideoHealthy((stats.sendFrameRate ?? stats.captureFrameRate ?? 0) > 0);
          }, 1200);

          setMessage('You are live in this Expression.');
          setNetworkLabel('Strong');
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
      joinedRef.current = false;
      if (levelTimer) clearInterval(levelTimer);
      if (healthTimer) clearInterval(healthTimer);
      client.removeAllListeners();
      agoraAutoplay.onAutoplayFailed = previousAutoplayHandler;
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      localAudioRef.current = null;
      localVideoRef.current = null;
      remoteAudioRef.current = null;
      void client.leave().catch(() => {});
      clientRef.current = null;
      onLeave?.();
    };
  }, [grant.appId, grant.channelName, grant.token, grant.uid, onError, onJoined, onLeave, role]);

  const toggleMic = async () => {
    const track = localAudioRef.current;
    if (!track) return;
    const next = !micMuted;
    try {
      await track.setMuted(next);
      setMicMuted(next);
      setMessage(next ? 'Microphone muted.' : 'Microphone live.');
    } catch (value) {
      const text = errorText(value) || 'Unable to change microphone state.';
      setMessage(text);
      onError?.(text);
    }
  };

  const toggleCamera = async () => {
    const track = localVideoRef.current;
    if (!track) return;
    const next = !cameraMuted;
    try {
      await track.setMuted(next);
      setCameraMuted(next);
      setMessage(next ? 'Camera paused.' : 'Camera live.');
    } catch (value) {
      const text = errorText(value) || 'Unable to change camera state.';
      setMessage(text);
      onError?.(text);
    }
  };

  const switchCamera = async () => {
    const track = localVideoRef.current;
    if (!track || switchingCamera) return;
    setSwitchingCamera(true);
    try {
      const available = cameras.length > 1 ? cameras : await AgoraRTC.getCameras();
      if (available.length < 2) {
        setCameras(available);
        setMessage('No second camera was detected on this device.');
        return;
      }
      const nextIndex = (cameraIndex + 1) % available.length;
      await track.setDevice(available[nextIndex].deviceId);
      setCameras(available);
      setCameraIndex(nextIndex);
      if (hostContainerRef.current) {
        track.stop();
        track.play(hostContainerRef.current, { fit: 'cover', mirror: !/back|rear|environment/i.test(available[nextIndex].label) });
      }
      setMessage(`Camera switched to ${available[nextIndex].label || `camera ${nextIndex + 1}`}.`);
    } catch (value) {
      const text = errorText(value) || 'Unable to switch camera.';
      setMessage(text);
      onError?.(text);
    } finally {
      setSwitchingCamera(false);
    }
  };

  const enableSound = () => {
    try {
      remoteAudioRef.current?.play();
      setAudioBlocked(false);
      setMessage('Sound enabled.');
    } catch (value) {
      const text = errorText(value) || 'Tap again to enable sound.';
      setMessage(text);
    }
  };

  const meterBars = [0.15, 0.35, 0.55, 0.75].map((threshold, index) =>
    React.createElement('span', {
      key: threshold,
      style: {
        width: 3,
        height: 7 + index * 3,
        borderRadius: 999,
        background: micMuted ? 'rgba(255,255,255,0.28)' : micLevel >= threshold ? '#34D399' : 'rgba(255,255,255,0.28)',
      },
    }),
  );

  return React.createElement(
    'div',
    {
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 260,
        background: '#02050A',
        overflow: 'hidden',
        borderRadius: 'inherit',
      },
    },
    React.createElement('div', {
      ref: role === 'publisher' ? hostContainerRef : remoteContainerRef,
      style: { position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#02050A' },
    }),
    role === 'publisher' && cameraMuted
      ? React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              background: 'radial-gradient(circle at center, #152238 0%, #03070D 65%)',
              fontSize: 14,
              fontWeight: 700,
            },
          },
          'Camera is off',
        )
      : null,
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          pointerEvents: 'none',
        },
      },
      React.createElement(
        'span',
        {
          style: {
            background: role === 'publisher' && joined ? '#E11D48' : 'rgba(7,12,20,0.76)',
            color: '#fff',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.8,
          },
        },
        role === 'publisher' && joined ? 'LIVE' : role === 'subscriber' ? 'EXPRESSION LIVE' : 'CONNECTING',
      ),
      React.createElement(
        'span',
        {
          style: {
            background: 'rgba(7,12,20,0.76)',
            color: '#D7E3F4',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 10,
            fontWeight: 800,
          },
        },
        networkLabel,
      ),
    ),
    role === 'publisher'
      ? React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            },
          },
          React.createElement(
            'div',
            {
              style: {
                alignSelf: 'center',
                maxWidth: '92%',
                padding: '7px 11px',
                borderRadius: 999,
                background: 'rgba(5,9,15,0.72)',
                color: '#E8EEF8',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
              },
            },
            videoHealthy || cameraMuted ? message : joined ? 'Camera connected — checking video frames…' : message,
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' } },
            React.createElement(
              'button',
              { type: 'button', onClick: () => void toggleMic(), style: { ...controlButtonStyle, background: micMuted ? '#A61B32' : controlButtonStyle.background } },
              React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 } },
                micMuted ? 'Mic off' : 'Mic',
                React.createElement('span', { style: { display: 'flex', alignItems: 'end', gap: 2 } }, meterBars),
              ),
            ),
            React.createElement(
              'button',
              { type: 'button', onClick: () => void toggleCamera(), style: { ...controlButtonStyle, background: cameraMuted ? '#A61B32' : controlButtonStyle.background } },
              cameraMuted ? 'Camera off' : 'Camera',
            ),
            React.createElement(
              'button',
              { type: 'button', onClick: () => void switchCamera(), disabled: switchingCamera, style: { ...controlButtonStyle, opacity: switchingCamera ? 0.55 : 1 } },
              switchingCamera ? 'Switching…' : 'Flip camera',
            ),
          ),
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div',
            {
              style: {
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                color: '#fff',
                fontSize: 12,
                textAlign: 'center',
                textShadow: '0 1px 2px #000',
                pointerEvents: 'none',
              },
            },
            message,
          ),
          audioBlocked
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: enableSound,
                  style: {
                    ...controlButtonStyle,
                    position: 'absolute',
                    left: '50%',
                    bottom: 48,
                    transform: 'translateX(-50%)',
                    background: '#168FF0',
                    borderColor: '#168FF0',
                    minWidth: 140,
                  },
                },
                'Enable sound',
              )
            : null,
        ),
  );
}
