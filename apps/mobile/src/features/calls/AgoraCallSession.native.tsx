import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChannelProfileType,
  createAgoraRtcEngine,
  RenderModeType,
  RtcSurfaceView,
  type IRtcEngine,
} from 'react-native-agora';
import type { AgoraCallSessionProps } from './call-types';

async function requestCallPermissions(video: boolean) {
  if (Platform.OS !== 'android') return true;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (video) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const audio = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  const camera = !video || result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
  return audio && camera;
}

export function AgoraCallSession({ grant, kind, scope, otherName, onJoined, onError }: AgoraCallSessionProps) {
  const engineRef = useRef<IRtcEngine | null>(null);
  const callbacks = useRef({ onJoined, onError });
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(kind === 'audio');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [facing, setFacing] = useState<'front' | 'rear'>('front');
  const [status, setStatus] = useState('Connecting…');

  useEffect(() => { callbacks.current = { onJoined, onError }; }, [onError, onJoined]);

  useEffect(() => {
    let disposed = false;
    const start = async () => {
      try {
        if (!(await requestCallPermissions(kind === 'video'))) throw new Error('Microphone permission is required. Video calls also need camera permission.');
        const engine = createAgoraRtcEngine();
        engineRef.current = engine;
        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (disposed) return;
            setStatus('Connected');
            callbacks.current.onJoined?.();
          },
          onUserJoined: (_connection, uid) => {
            if (disposed) return;
            setRemoteUids((current) => current.includes(uid) ? current : [...current, uid]);
          },
          onUserOffline: (_connection, uid) => {
            if (disposed) return;
            setRemoteUids((current) => current.filter((item) => item !== uid));
          },
          onConnectionStateChanged: (_connection, state) => {
            if (disposed) return;
            setStatus(state === 3 ? 'Connected' : state === 4 ? 'Reconnecting…' : 'Connecting…');
          },
          onError: (code) => callbacks.current.onError?.(`Call connection error (${code}).`),
        });
        engine.initialize({ appId: grant.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
        engine.enableAudio();
        engine.setEnableSpeakerphone(true);
        if (kind === 'video') {
          engine.enableVideo();
          engine.startPreview();
        }
        engine.joinChannel(grant.token, grant.channelName, grant.uid, {
          autoSubscribeAudio: true,
          autoSubscribeVideo: kind === 'video',
          publishMicrophoneTrack: true,
          publishCameraTrack: kind === 'video',
        });
      } catch (value) {
        callbacks.current.onError?.(value instanceof Error ? value.message : 'Unable to join this call.');
      }
    };
    void start();
    return () => {
      disposed = true;
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        try {
          if (kind === 'video') engine.stopPreview();
          engine.leaveChannel();
          engine.release();
        } catch {}
      }
    };
  }, [grant.appId, grant.channelName, grant.token, grant.uid, kind]);

  const toggleMic = () => {
    const next = !micMuted;
    engineRef.current?.muteLocalAudioStream(next);
    setMicMuted(next);
  };
  const toggleCamera = () => {
    if (kind !== 'video') return;
    const next = !cameraMuted;
    engineRef.current?.muteLocalVideoStream(next);
    setCameraMuted(next);
  };
  const flip = () => {
    if (kind !== 'video') return;
    engineRef.current?.switchCamera();
    setFacing((current) => current === 'front' ? 'rear' : 'front');
  };
  const toggleSpeaker = () => {
    const next = !speakerOn;
    engineRef.current?.setEnableSpeakerphone(next);
    setSpeakerOn(next);
  };

  const groupVideoUids = kind === 'video' ? [0, ...remoteUids] : [];
  const total = remoteUids.length + 1;
  const groupTile = useMemo(() => {
    if (total <= 1) return { width: '100%' as const, minHeight: '100%' as const };
    if (total <= 4) return { width: '50%' as const, minHeight: total <= 2 ? '100%' as const : '50%' as const };
    if (total <= 6) return { width: '33.333%' as const, minHeight: '50%' as const };
    return { width: '33.333%' as const, minHeight: '33.333%' as const };
  }, [total]);

  const remotePrimary = remoteUids[0];

  return (
    <View style={styles.root}>
      {kind === 'video' ? (
        scope === 'direct' ? (
          <View style={styles.directStage}>
            {remotePrimary ? (
              <RtcSurfaceView canvas={{ uid: remotePrimary, renderMode: RenderModeType.RenderModeHidden }} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={styles.waitingStage}>
                <View style={styles.directAvatar}><Text style={styles.directAvatarText}>{(otherName || 'C').slice(0, 1).toUpperCase()}</Text></View>
                <Text style={styles.directName}>{otherName || 'COT member'}</Text>
                <Text style={styles.directWaiting}>Waiting for the other person…</Text>
              </View>
            )}
            <View style={styles.localPip}>
              {cameraMuted ? (
                <View style={styles.placeholder}><Text style={styles.placeholderText}>Camera off</Text></View>
              ) : (
                <RtcSurfaceView key={`local-${facing}`} canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }} style={styles.video} />
              )}
              <Text style={styles.tileLabel}>You</Text>
            </View>
          </View>
        ) : (
          <View style={styles.grid}>
            {groupVideoUids.map((uid, index) => (
              <View key={uid === 0 ? `local-${facing}` : uid} style={[styles.groupTile, groupTile]}>
                {uid === 0 && cameraMuted ? (
                  <View style={styles.placeholder}><Text style={styles.placeholderText}>Camera off</Text></View>
                ) : (
                  <RtcSurfaceView canvas={{ uid, renderMode: RenderModeType.RenderModeFit }} style={styles.video} />
                )}
                <Text style={styles.tileLabel}>{uid === 0 ? 'You' : `Participant ${index + 1}`}</Text>
              </View>
            ))}
          </View>
        )
      ) : (
        <View style={styles.audioStage}>
          <View style={styles.audioGlow}>
            <View style={styles.audioOrb}><Text style={styles.audioOrbText}>{scope === 'direct' ? (otherName || 'C').slice(0, 1).toUpperCase() : 'COT'}</Text></View>
          </View>
          <Text style={styles.audioTitle}>{scope === 'direct' ? (otherName || 'Direct audio call') : `${total} in audio call`}</Text>
          <Text style={styles.audioMeta}>{scope === 'direct' && !remoteUids.length ? 'Calling…' : status}</Text>
        </View>
      )}
      <View style={styles.status}><Text style={styles.statusText}>{status} · {total} connected</Text></View>
      <View style={styles.controls}>
        <Control label={micMuted ? 'Unmute' : 'Mute'} onPress={toggleMic} active={micMuted} />
        {kind === 'video' ? <Control label={cameraMuted ? 'Camera on' : 'Camera off'} onPress={toggleCamera} active={cameraMuted} /> : null}
        {kind === 'video' ? <Control label='Flip' onPress={flip} /> : null}
        <Control label={speakerOn ? 'Speaker' : 'Earpiece'} onPress={toggleSpeaker} active={!speakerOn} />
      </View>
    </View>
  );
}

function Control({ label, onPress, active = false }: { label: string; onPress: () => void; active?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.control, active && styles.controlActive]}><Text style={styles.controlText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03060B' },
  directStage: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#070D16' },
  waitingStage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09111E' },
  directAvatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#182538', alignItems: 'center', justifyContent: 'center' },
  directAvatarText: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  directName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 16 },
  directWaiting: { color: '#94A3B8', fontSize: 12, marginTop: 6 },
  localPip: { position: 'absolute', right: 14, bottom: 92, width: 124, height: 170, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 5, alignContent: 'stretch' },
  groupTile: { padding: 3, overflow: 'hidden' },
  video: { flex: 1, minHeight: 120, backgroundColor: '#0B111B', borderRadius: 16 },
  placeholder: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', borderRadius: 16 },
  placeholderText: { color: '#D1D5DB', fontWeight: '800' },
  tileLabel: { position: 'absolute', left: 11, bottom: 9, color: '#FFFFFF', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.48)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99 },
  audioStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#08101C' },
  audioGlow: { width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(14,165,233,0.10)', alignItems: 'center', justifyContent: 'center' },
  audioOrb: { width: 116, height: 116, borderRadius: 58, backgroundColor: '#1B283A', alignItems: 'center', justifyContent: 'center' },
  audioOrbText: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  audioTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  audioMeta: { color: '#9CA3AF', fontSize: 13 },
  status: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  statusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  controls: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 82, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, backgroundColor: '#03060B' },
  control: { minWidth: 82, height: 46, borderRadius: 23, backgroundColor: '#151B25', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  controlActive: { backgroundColor: '#7F1D1D', borderColor: '#B91C1C' },
  controlText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
