import React, { useEffect, useRef, useState } from 'react';
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

export function AgoraCallSession({ grant, kind, onJoined, onError }: AgoraCallSessionProps) {
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

  const videoUids = kind === 'video' ? [0, ...remoteUids] : [];
  return (
    <View style={styles.root}>
      {kind === 'video' ? (
        <View style={styles.grid}>
          {videoUids.map((uid) => (
            <View key={uid === 0 ? `local-${facing}` : uid} style={styles.tile}>
              {uid === 0 && cameraMuted ? (
                <View style={styles.placeholder}><Text style={styles.placeholderText}>Camera off</Text></View>
              ) : (
                <RtcSurfaceView canvas={{ uid, renderMode: RenderModeType.RenderModeFit }} style={styles.video} />
              )}
              <Text style={styles.tileLabel}>{uid === 0 ? 'You' : 'Participant'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.audioStage}>
          <View style={styles.audioOrb}><Text style={styles.audioOrbText}>COT</Text></View>
          <Text style={styles.audioTitle}>{remoteUids.length + 1} in audio call</Text>
          <Text style={styles.audioMeta}>{status}</Text>
        </View>
      )}
      <View style={styles.status}><Text style={styles.statusText}>{status} · {remoteUids.length + 1} connected</Text></View>
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
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6, alignContent: 'stretch' },
  tile: { width: '50%', minHeight: '48%', padding: 3, overflow: 'hidden', borderRadius: 16 },
  video: { flex: 1, minHeight: 190, backgroundColor: '#0B111B', borderRadius: 14 },
  placeholder: { flex: 1, minHeight: 190, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', borderRadius: 14 },
  placeholderText: { color: '#D1D5DB', fontWeight: '800' },
  tileLabel: { position: 'absolute', left: 12, bottom: 10, color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  audioStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  audioOrb: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  audioOrbText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  audioTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  audioMeta: { color: '#9CA3AF', fontSize: 13 },
  status: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  statusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  controls: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  control: { minWidth: 76, height: 46, borderRadius: 23, backgroundColor: '#151B25', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  controlActive: { backgroundColor: '#7F1D1D' },
  controlText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
