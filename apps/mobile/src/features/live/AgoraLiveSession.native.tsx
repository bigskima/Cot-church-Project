import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
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
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [message, setMessage] = useState(role === 'publisher' ? 'Preparing camera…' : 'Joining live service…');

  useEffect(() => {
    let disposed = false;

    const start = async () => {
      try {
        if (role === 'publisher' && !(await requestBroadcastPermissions())) {
          throw new Error('Camera and microphone permission are required to broadcast live.');
        }

        const engine = createAgoraRtcEngine();
        engineRef.current = engine;
        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (disposed) return;
            setJoined(true);
            setMessage(role === 'publisher' ? 'You are live in this Expression.' : 'Connected to the live service.');
            onJoined?.();
          },
          onUserJoined: (_connection, uid) => {
            if (disposed || role !== 'subscriber') return;
            setRemoteUid(uid);
            setMessage('Watching live.');
          },
          onUserOffline: (_connection, uid) => {
            if (disposed || remoteUid !== uid) return;
            setRemoteUid(null);
            setMessage('The broadcaster has left. Waiting for the live service to resume…');
          },
          onError: (errorCode) => {
            if (disposed) return;
            const errorMessage = `Agora connection error (${errorCode}).`;
            setMessage(errorMessage);
            onError?.(errorMessage);
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
        const errorMessage = value instanceof Error ? value.message : 'Unable to join the Expression live session.';
        setMessage(errorMessage);
        onError?.(errorMessage);
      }
    };

    void start();
    return () => {
      disposed = true;
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

  return (
    <View style={styles.container}>
      {role === 'publisher' ? (
        <RtcSurfaceView canvas={{ uid: 0 }} style={styles.video} />
      ) : remoteUid ? (
        <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.video} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{message}</Text>
        </View>
      )}
      {joined && role === 'publisher' ? (
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  video: { flex: 1, backgroundColor: '#000000' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#05070A' },
  placeholderText: { color: '#FFFFFF', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  liveBadge: { position: 'absolute', top: 12, right: 12, borderRadius: 999, backgroundColor: '#E11D48', paddingHorizontal: 10, paddingVertical: 5 },
  liveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});
