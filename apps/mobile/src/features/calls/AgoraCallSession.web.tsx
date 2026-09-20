import React, { useEffect, useRef, useState } from 'react';
import AgoraRTC, { type IAgoraRTCClient, type ICameraVideoTrack, type IMicrophoneAudioTrack, type IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import type { AgoraCallSessionProps } from './call-types';

export function AgoraCallSession({ grant, kind, onJoined, onError }: AgoraCallSessionProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoRef = useRef<ICameraVideoTrack | null>(null);
  const remoteRef = useRef<Map<number, IAgoraRTCRemoteUser>>(new Map());
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(kind === 'audio');
  const [status, setStatus] = useState('Connecting…');

  useEffect(() => {
    let disposed = false;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    const playRemoteVideo = (user: IAgoraRTCRemoteUser) => {
      if (!user.videoTrack) return;
      const id = `cot-call-remote-${user.uid}`;
      requestAnimationFrame(() => {
        if (!disposed && document.getElementById(id)) user.videoTrack?.play(id, { fit: 'contain' });
      });
    };

    client.on('user-published', async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        if (disposed) return;
        remoteRef.current.set(Number(user.uid), user);
        setRemoteUids((current) => current.includes(Number(user.uid)) ? current : [...current, Number(user.uid)]);
        if (mediaType === 'audio') user.audioTrack?.play();
        if (mediaType === 'video') playRemoteVideo(user);
      } catch (value) {
        onError?.(value instanceof Error ? value.message : 'Unable to receive a participant stream.');
      }
    });
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') user.videoTrack?.stop();
    });
    client.on('user-left', (user) => {
      remoteRef.current.delete(Number(user.uid));
      setRemoteUids((current) => current.filter((uid) => uid !== Number(user.uid)));
    });
    client.on('connection-state-change', (state) => {
      if (!disposed) setStatus(state === 'CONNECTED' ? 'Connected' : state === 'RECONNECTING' ? 'Reconnecting…' : 'Connecting…');
    });

    const start = async () => {
      try {
        await client.join(grant.appId, grant.channelName, grant.token, grant.uid);
        if (disposed) return;
        const audio = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
        audioRef.current = audio;
        let video: ICameraVideoTrack | null = null;
        if (kind === 'video') {
          video = await AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p_1' });
          videoRef.current = video;
          requestAnimationFrame(() => {
            if (!disposed && document.getElementById('cot-call-local')) video?.play('cot-call-local', { fit: 'contain', mirror: true });
          });
        }
        await client.publish(video ? [audio, video] : [audio]);
        if (disposed) return;
        setStatus('Connected');
        onJoined?.();
      } catch (value) {
        onError?.(value instanceof Error ? value.message : 'Unable to join this call.');
      }
    };
    void start();

    return () => {
      disposed = true;
      client.removeAllListeners();
      audioRef.current?.close();
      videoRef.current?.close();
      remoteRef.current.forEach((user) => { user.videoTrack?.stop(); user.audioTrack?.stop(); });
      void client.leave().catch(() => {});
      clientRef.current = null;
    };
  }, [grant.appId, grant.channelName, grant.token, grant.uid, kind]);

  useEffect(() => {
    if (kind !== 'video') return;
    for (const uid of remoteUids) {
      const user = remoteRef.current.get(uid);
      if (user?.videoTrack) requestAnimationFrame(() => user.videoTrack?.play(`cot-call-remote-${uid}`, { fit: 'contain' }));
    }
  }, [kind, remoteUids]);

  const toggleMic = async () => {
    const next = !micMuted;
    await audioRef.current?.setMuted(next);
    setMicMuted(next);
  };
  const toggleCamera = async () => {
    if (kind !== 'video') return;
    const next = !cameraMuted;
    await videoRef.current?.setMuted(next);
    setCameraMuted(next);
  };
  const flip = async () => {
    const track = videoRef.current;
    if (!track) return;
    const cameras = await AgoraRTC.getCameras();
    if (cameras.length < 2) return;
    const current = track.getMediaStreamTrack().getSettings().deviceId;
    const target = cameras.find((camera) => camera.deviceId !== current);
    if (target) await track.setDevice(target.deviceId);
  };

  return (
    <div style={{ minHeight: '100%', height: '100%', background: '#03060B', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {kind === 'video' ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8, padding: 8 }}>
          <div id='cot-call-local' style={{ minHeight: 220, borderRadius: 16, overflow: 'hidden', background: '#111827', position: 'relative' }}>
            {cameraMuted ? <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontWeight: 800 }}>Camera off</div> : null}
          </div>
          {remoteUids.map((uid) => <div key={uid} id={`cot-call-remote-${uid}`} style={{ minHeight: 220, borderRadius: 16, overflow: 'hidden', background: '#111827' }} />)}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div><div style={{ width: 112, height: 112, borderRadius: 999, background: '#1F2937', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 28, fontWeight: 900 }}>COT</div><div style={{ fontSize: 20, fontWeight: 900 }}>{remoteUids.length + 1} in audio call</div><div style={{ color: '#9CA3AF', marginTop: 8 }}>{status}</div></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: 16 }}>
        <button onClick={() => void toggleMic()} style={buttonStyle}>{micMuted ? 'Unmute' : 'Mute'}</button>
        {kind === 'video' ? <button onClick={() => void toggleCamera()} style={buttonStyle}>{cameraMuted ? 'Camera on' : 'Camera off'}</button> : null}
        {kind === 'video' ? <button onClick={() => void flip()} style={buttonStyle}>Flip camera</button> : null}
      </div>
    </div>
  );
}
const buttonStyle: React.CSSProperties = { border: 0, minWidth: 86, height: 46, borderRadius: 999, background: '#151B25', color: '#fff', fontWeight: 800, cursor: 'pointer' };
