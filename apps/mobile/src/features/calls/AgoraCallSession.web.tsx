import React, { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, { type IAgoraRTCClient, type ICameraVideoTrack, type IMicrophoneAudioTrack, type IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import type { AgoraCallSessionProps } from './call-types';

export function AgoraCallSession({ grant, kind, scope, otherName, onJoined, onError, overlayBottomInset = 72 }: AgoraCallSessionProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoRef = useRef<ICameraVideoTrack | null>(null);
  const remoteRef = useRef<Map<number, IAgoraRTCRemoteUser>>(new Map());
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(kind === 'audio');
  const [status, setStatus] = useState('Connecting…');
  const [directLocalPrimary, setDirectLocalPrimary] = useState(false);

  useEffect(() => {
    let disposed = false;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    const playRemoteVideo = (user: IAgoraRTCRemoteUser) => {
      if (!user.videoTrack) return;
      const id = `cot-call-remote-${user.uid}`;
      requestAnimationFrame(() => {
        if (!disposed && document.getElementById(id)) user.videoTrack?.play(id, { fit: scope === 'direct' ? 'cover' : 'contain' });
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
            if (!disposed && document.getElementById('cot-call-local')) video?.play('cot-call-local', { fit: 'cover', mirror: true });
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
  }, [grant.appId, grant.channelName, grant.token, grant.uid, kind, scope]);

  useEffect(() => {
    if (kind !== 'video') return;
    for (const uid of remoteUids) {
      const user = remoteRef.current.get(uid);
      if (user?.videoTrack) requestAnimationFrame(() => user.videoTrack?.play(`cot-call-remote-${uid}`, { fit: scope === 'direct' ? 'cover' : 'contain' }));
    }
  }, [kind, remoteUids, scope]);

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

  const total = remoteUids.length + 1;
  const columns = useMemo(() => {
    if (total <= 1) return '1fr';
    if (total === 2) return 'repeat(auto-fit,minmax(min(100%,280px),1fr))';
    if (total <= 4) return 'repeat(2,minmax(0,1fr))';
    if (total <= 6) return 'repeat(3,minmax(0,1fr))';
    return 'repeat(auto-fit,minmax(180px,1fr))';
  }, [total]);
  const remotePrimary = remoteUids[0];

  return (
    <div style={{ minHeight: '100%', height: '100%', background: '#03060B', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {kind === 'video' ? (
        scope === 'direct' ? (
          <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', background: '#070D16' }}>
            {remotePrimary ? (
              <div
                id={`cot-call-remote-${remotePrimary}`}
                role='button'
                tabIndex={0}
                aria-label={directLocalPrimary ? 'Make the other person large' : 'Other person is large. Tap to swap'}
                onClick={() => setDirectLocalPrimary((current) => !current)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setDirectLocalPrimary((current) => !current); }}
                style={directLocalPrimary ? directPipStyle : directPrimaryStyle}
              >
                <div style={tileLabelStyle}>{directLocalPrimary ? (otherName || 'Other person') : `${otherName || 'Other person'} · tap to swap`}</div>
              </div>
            ) : (
              <div
                style={directLocalPrimary ? directWaitingPipStyle : directPrimaryStyle}
                onClick={() => directLocalPrimary && setDirectLocalPrimary(false)}
              >
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at center,#14243a 0%,#050910 65%)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: directLocalPrimary ? 54 : 104, height: directLocalPrimary ? 54 : 104, borderRadius: 999, background: '#172335', display: 'grid', placeItems: 'center', margin: '0 auto 10px', fontSize: directLocalPrimary ? 18 : 30, fontWeight: 900 }}>{(otherName || 'C').slice(0, 1).toUpperCase()}</div>
                    {!directLocalPrimary ? <div style={{ fontSize: 18, fontWeight: 900 }}>{otherName || 'Waiting for answer'}</div> : null}
                    <div style={{ color: '#93A4B8', fontSize: directLocalPrimary ? 9 : 12, marginTop: 4 }}>Waiting…</div>
                  </div>
                </div>
              </div>
            )}

            <div
              id='cot-call-local'
              role='button'
              tabIndex={0}
              aria-label={directLocalPrimary ? 'Your video is large. Tap to swap' : 'Make your video large'}
              onClick={() => setDirectLocalPrimary((current) => !current)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setDirectLocalPrimary((current) => !current); }}
              style={directLocalPrimary ? directPrimaryStyle : directPipStyle}
            >
              {cameraMuted ? <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#AAB5C4' }}>Camera off</div> : null}
              <div style={tileLabelStyle}>{directLocalPrimary ? 'You · tap to swap' : 'You · tap to enlarge'}</div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: columns, gridAutoRows: total === 2 ? 'minmax(240px,1fr)' : total <= 4 ? 'minmax(190px,1fr)' : 'minmax(170px,1fr)', gap: 8, padding: 8, overflow: 'auto' }}>
            <div id='cot-call-local' style={tileStyle}>
              {cameraMuted ? <div style={placeholderStyle}>Camera off</div> : null}
              <div style={tileLabelStyle}>You</div>
            </div>
            {remoteUids.map((uid, index) => (
              <div key={uid} id={`cot-call-remote-${uid}`} style={tileStyle}>
                <div style={tileLabelStyle}>Participant {index + 2}</div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', background: 'radial-gradient(circle at center,#14243a 0%,#050910 65%)' }}>
          <div>
            <div style={{ width: 118, height: 118, borderRadius: 999, background: '#1B283A', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 30, fontWeight: 900 }}>{scope === 'direct' ? (otherName || 'C').slice(0, 1).toUpperCase() : 'COT'}</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{scope === 'direct' ? (otherName || 'Direct audio call') : `${total} in audio call`}</div>
            <div style={{ color: '#9CA3AF', marginTop: 8 }}>{scope === 'direct' && !remoteUids.length ? 'Calling…' : status}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: `14px 16px ${overlayBottomInset + 14}px`, background: 'linear-gradient(180deg,rgba(3,6,11,.15),#03060B)' }}>
        <button onClick={() => void toggleMic()} style={{ ...buttonStyle, ...(micMuted ? activeButtonStyle : {}) }}>{micMuted ? 'Unmute' : 'Mute'}</button>
        {kind === 'video' ? <button onClick={() => void toggleCamera()} style={{ ...buttonStyle, ...(cameraMuted ? activeButtonStyle : {}) }}>{cameraMuted ? 'Camera on' : 'Camera off'}</button> : null}
        {kind === 'video' ? <button onClick={() => void flip()} style={buttonStyle}>Flip camera</button> : null}
      </div>
    </div>
  );
}
const directPrimaryStyle: React.CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden', background: '#0B111B', cursor: 'pointer' };
const directPipStyle: React.CSSProperties = { position: 'absolute', right: 14, bottom: 86, width: 'clamp(108px,24vw,190px)', aspectRatio: '3 / 4', borderRadius: 20, overflow: 'hidden', background: '#111827', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 12px 30px rgba(0,0,0,.4)', cursor: 'pointer', zIndex: 4 };
const directWaitingPipStyle: React.CSSProperties = { ...directPipStyle, cursor: 'default' };
const tileStyle: React.CSSProperties = { minHeight: 190, borderRadius: 18, overflow: 'hidden', background: '#111827', position: 'relative' };
const placeholderStyle: React.CSSProperties = { height: '100%', minHeight: 190, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#AAB5C4' };
const tileLabelStyle: React.CSSProperties = { position: 'absolute', left: 10, bottom: 9, padding: '4px 8px', borderRadius: 999, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 10, fontWeight: 800, pointerEvents: 'none' };
const buttonStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.1)', minWidth: 92, height: 46, borderRadius: 999, background: '#151B25', color: '#fff', fontWeight: 800, cursor: 'pointer', padding: '0 16px' };
const activeButtonStyle: React.CSSProperties = { background: '#7F1D1D', borderColor: '#B91C1C' };
