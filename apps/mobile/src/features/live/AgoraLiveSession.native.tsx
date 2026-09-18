import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  type IRtcEngine,
  RtcSurfaceView,
} from 'react-native-agora';
import type { AgoraLiveSessionProps } from './agora-types';

async function requestBroadcastPermissions() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
    && result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
}

export function AgoraLiveSession({ grant, role, onJoined, onLeave, onError }: AgoraLiveSessionProps) {
  const engineRef = useRef<IRtcEngine | null>(null);
  const disposedRef = useRef(false);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [message, setMessage] = useState(role === 'publisher' ? 'Preparing camera and microphone…' : 'Joining live service…');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [networkLabel, setNetworkLabel] = useState('Connecting');

  useEffect(() => {
    disposedRef.current = false;

    const reportError = (errorMessage: string) => {
      if (disposedRef.current) return;
      setMessage(errorMessage);
      onError?.(errorMessage);
    };

    const start = async () => {
      try {
        if (role === 'publisher' && !(await requestBroadcastPermissions())) {
          throw new Error('Camera and microphone permission are required to broadcast live.');
        }

        const engine = createAgoraRtcEngine();
        engineRef.current = engine;
        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (disposedRef.current) return;
            setJoined(true);
            setNetworkLabel('Connected');
            setMessage(role === 'publisher' ? 'You are live in this Expression.' : 'Connected to the live service.');
            onJoined?.();
          },
          onUserJoined: (_connection, uid) => {
            if (disposedRef.current || role !== 'subscriber') return;
            setRemoteUid(uid);
            setMessage('Watching live.');
          },
          onUserOffline: (_connection, uid) => {
            if (disposedRef.current || role !== 'subscriber') return;
            setRemoteUid((current) => current === uid ? null : current);
            setMessage('The broadcaster has left this live session.');
          },
          onNetworkQuality: (_connection, _remoteUid, txQuality, rxQuality) => {
            if (disposedRef.current) return;
            const quality = role === 'publisher' ? txQuality : rxQuality;
            setNetworkLabel(quality <= 2 ? 'Strong' : quality <= 4 ? 'Fair' : 'Weak');
          },
          onError: (errorCode) => {
            reportError(`Agora connection error (${errorCode}).`);
          },
        });

        engine.initialize({
          appId: grant.appId,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        });
        engine.enableVideo();

        if (role === 'publisher') {
          engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
          engine.startPreview();
        } else {
          engine.setClientRole(ClientRoleType.ClientRoleAudience);
        }

        engine.joinChannel(grant.token, grant.channelName, grant.uid, {
          clientRoleType: role === 'publisher'
            ? ClientRoleType.ClientRoleBroadcaster
            : ClientRoleType.ClientRoleAudience,
          autoSubscribeAudio: role === 'subscriber',
          autoSubscribeVideo: role === 'subscriber',
          publishCameraTrack: role === 'publisher',
          publishMicrophoneTrack: role === 'publisher',
        });
      } catch (value) {
        reportError(value instanceof Error ? value.message : 'Unable to join the Expression live session.');
      }
    };

    void start();
    return () => {
      disposedRef.current = true;
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        try {
          if (role === 'publisher') engine.stopPreview();
          engine.leaveChannel();
          engine.release();
        } catch {
          // The engine may already have been released by the native runtime.
        }
      }
      onLeave?.();
    };
  }, [grant.appId, grant.channelName, grant.token, grant.uid, onError, onJoined, onLeave, role]);

  const toggleMic = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !micMuted;
    try {
      engine.muteLocalAudioStream(next);
      setMicMuted(next);
      setMessage(next ? 'Microphone muted.' : 'Microphone live.');
    } catch {
      onError?.('Unable to change microphone state.');
    }
  };

  const toggleCamera = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !cameraMuted;
    try {
      engine.muteLocalVideoStream(next);
      setCameraMuted(next);
      setMessage(next ? 'Camera paused.' : 'Camera live.');
    } catch {
      onError?.('Unable to change camera state.');
    }
  };

  const switchCamera = () => {
    const engine = engineRef.current;
    if (!engine || switchingCamera) return;
    setSwitchingCamera(true);
    try {
      engine.switchCamera();
      setMessage('Camera switched.');
    } catch {
      onError?.('Unable to switch camera.');
    } finally {
      setTimeout(() => setSwitchingCamera(false), 500);
    }
  };

  return (
    <View style={styles.container}>
      {role === 'publisher' ? (
        cameraMuted ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>Camera is off</Text>
            <Text style={styles.placeholderText}>{message}</Text>
          </View>
        ) : (
          <RtcSurfaceView canvas={{ uid: 0 }} style={styles.video} />
        )
      ) : remoteUid ? (
        <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.video} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{message}</Text>
        </View>
      )}

      <View style={styles.topRow} pointerEvents="none">
        <View style={[styles.badge, role === 'publisher' && joined ? styles.liveBadge : styles.neutralBadge]}>
          <Text style={styles.badgeText}>{role === 'publisher' && joined ? 'LIVE' : role === 'subscriber' ? 'EXPRESSION LIVE' : 'CONNECTING'}</Text>
        </View>
        <View style={[styles.badge, styles.neutralBadge]}>
          <Text style={styles.badgeText}>{networkLabel}</Text>
        </View>
      </View>

      {role === 'publisher' ? (
        <View style={styles.controls}>
          <Text style={styles.statusText}>{message}</Text>
          <View style={styles.controlsRow}>
            <Pressable onPress={toggleMic} style={[styles.controlButton, micMuted && styles.controlDanger]}>
              <Text style={styles.controlText}>{micMuted ? 'Mic off' : 'Mic'}</Text>
            </Pressable>
            <Pressable onPress={toggleCamera} style={[styles.controlButton, cameraMuted && styles.controlDanger]}>
              <Text style={styles.controlText}>{cameraMuted ? 'Camera off' : 'Camera'}</Text>
            </Pressable>
            <Pressable onPress={switchCamera} disabled={switchingCamera} style={[styles.controlButton, switchingCamera && styles.controlDisabled]}>
              <Text style={styles.controlText}>{switchingCamera ? 'Switching…' : 'Flip camera'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.viewerStatus} pointerEvents="none">
          <Text style={styles.statusText}>{message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02050A', overflow: 'hidden' },
  video: { flex: 1, backgroundColor: '#02050A' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#050A12', gap: 8 },
  placeholderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  placeholderText: { color: '#D7E3F4', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  liveBadge: { backgroundColor: '#E11D48' },
  neutralBadge: { backgroundColor: 'rgba(7,12,20,0.76)' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  controls: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 10, alignItems: 'center' },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  controlButton: { minWidth: 76, height: 48, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,12,20,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  controlDanger: { backgroundColor: '#A61B32' },
  controlDisabled: { opacity: 0.55 },
  controlText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 3 },
  viewerStatus: { position: 'absolute', left: 12, right: 12, bottom: 12 },
});
