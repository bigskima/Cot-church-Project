import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View, ViewToken } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { shareContent } from '@/services/share';
import { BottomSheet, Button, ContentReportSheet, Icon, ReelPlayer, ResourceError, Skeleton } from '@/components';
import type { Reel } from '@/types/content';
import { TourAnchor } from '@/features/tour/AppTourProvider';

const { height: windowHeight } = Dimensions.get('window');
type PlaybackInfo = { available: boolean; renditions?: { kind?: string; playbackUrl?: string; storagePath?: string }[] };
type ReelEngagementState = { reaction: string | null; bookmarked: boolean };
type PlaybackBatchEntry = PlaybackInfo & { contentId: string };
type EngagementBatchEntry = ReelEngagementState & { contentId: string };
type ReelWithViewerState = Reel & { viewerReaction?: string | null; viewerBookmarked?: boolean };

export function ReelsExperience({ scope = 'general', reelId: forcedReelId }: { scope?: 'general' | 'expression'; reelId?: string }) {
  const insets = useSafeAreaInsets();
  const { api, mode, context } = useSession();
  const routeParams = useLocalSearchParams<{ reelId?: string }>();
  const reelId = forcedReelId ?? routeParams.reelId;
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionError, setActionError] = useState('');
  const [shareTarget, setShareTarget] = useState<ReelWithViewerState | null>(null);
  const [reportTarget, setReportTarget] = useState<ReelWithViewerState | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const listRef = useRef<FlatList<ReelWithViewerState>>(null);
  const appliedDeepLinkRef = useRef<string | null>(null);
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const expressionId = scope === 'expression' ? context?.expression?.id : undefined;
  const returnTo = expressionId ? `/expressions/${expressionId}/reels` : '/general/reels';

  // Fetch the Reel catalogue first. Viewer engagement and signed playback URLs are
  // intentionally separate requests so a slower authenticated/mobile request can
  // no longer keep the entire immersive surface black.
  const reelsResource = useResource<Reel[]>(`reels:immersive:${expressionId ? `expression:${expressionId}` : `public:${organizationId || 'auto'}`}:${mode}`, async (signal) => expressionId
    ? (await api.request<{ reels: Reel[] }>(`home-feed?organizationId=${encodeURIComponent(organizationId)}&expressionId=${encodeURIComponent(expressionId)}`, { signal })).reels
    : api.request<Reel[]>(`public-content?type=reels${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ''}`, { signal }));

  const catalogue = reelsResource.data ?? [];
  const contentIds = useMemo(
    () => catalogue.map((reel) => reel.content_items?.id).filter(Boolean) as string[],
    [catalogue],
  );

  const engagement = useResource<EngagementBatchEntry[]>(`reels:engagement:${expressionId ?? 'public'}:${mode}:${contentIds.join(',')}`, async (signal) => {
    if (mode !== 'authenticated' || !contentIds.length) return [];
    const batches: string[][] = [];
    for (let i = 0; i < contentIds.length; i += 30) batches.push(contentIds.slice(i, i + 30));
    return (await Promise.all(batches.map((ids) => api.request<EngagementBatchEntry[]>(`engagement?view=states&contentIds=${encodeURIComponent(ids.join(','))}`, { signal, context: expressionId ? 'current' : 'public' })))).flat();
  });

  const engagementMap = useMemo(() => new Map((engagement.data ?? []).map((item) => [item.contentId, item])), [engagement.data]);
  const reelsWithViewerState = useMemo<ReelWithViewerState[]>(() => catalogue.map((reel) => {
    const contentId = reel.content_items?.id;
    const state = contentId ? engagementMap.get(contentId) : undefined;
    return {
      ...reel,
      viewerReaction: state?.reaction ?? null,
      viewerBookmarked: state?.bookmarked ?? false,
    } as ReelWithViewerState;
  }), [catalogue, engagementMap]);

  // On native devices only the active Reel and its immediate neighbours need a
  // signed stream URL. Signing every Reel up front was expensive on mobile and
  // also encouraged many VideoPlayer instances to compete for network/buffer.
  const playbackIds = useMemo(() => {
    if (!reelsWithViewerState.length) return [] as string[];
    const first = Math.max(0, activeIndex - 1);
    const last = Math.min(reelsWithViewerState.length, activeIndex + 2);
    return reelsWithViewerState.slice(first, last).map((reel) => reel.content_items?.id).filter(Boolean) as string[];
  }, [activeIndex, reelsWithViewerState]);

  const playback = useResource<PlaybackBatchEntry[]>(`playback:reels:${expressionId ?? 'public'}:${mode}:${playbackIds.join(',')}`, async (signal) => {
    if (!playbackIds.length) return [];
    return api.request<PlaybackBatchEntry[]>(`content-media?action=playback_batch&contentIds=${encodeURIComponent(playbackIds.join(','))}`, { signal, context: expressionId ? 'current' : 'public' });
  });
  const playbackMap = useMemo(() => new Map((playback.data ?? []).map((item) => [item.contentId, item])), [playback.data]);
  const reels = useMemo(() => reelsWithViewerState.map((reel) => {
    const source = playbackMap.get(reel.content_items?.id ?? '');
    const playbackUrl = source?.renditions?.find((rendition) => rendition.kind === 'video_stream')?.playbackUrl;
    return playbackUrl ? { ...reel, media_assets: { ...reel.media_assets, url: playbackUrl } } as ReelWithViewerState : reel;
  }), [playbackMap, reelsWithViewerState]);

  const initialSurfaceLoading = reelsResource.loading && !reelsResource.data;
  const canShareToGeneral = mode === 'authenticated';

  useEffect(() => {
    if (!reelId || !reels.length || appliedDeepLinkRef.current === reelId) return;
    const targetIndex = reels.findIndex((item) => item.id === reelId);
    if (targetIndex < 0) return;
    appliedDeepLinkRef.current = reelId;
    setActiveIndex(targetIndex);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: targetIndex, animated: false }));
  }, [reelId, reels]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) setActiveIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const handleOpenComments = (reel: Reel) => {
    const contentId = reel.content_items?.id;
    if (!contentId) { setActionError('Comments are not available for this Reel yet.'); return; }
    router.push(expressionId ? { pathname: `/expressions/${expressionId}/comments/[contentId]`, params: { contentId } } as any : { pathname: '/general/comments/[contentId]', params: { contentId } } as any);
  };

  const handleLikeReel = async (reel: ReelWithViewerState, currentlyLiked: boolean) => {
    if (mode === 'visitor') { router.push({ pathname: '/(auth)/login', params: { returnTo } } as any); return currentlyLiked; }
    const contentId = reel.content_items?.id;
    if (!contentId) return currentlyLiked;
    try {
      setActionError('');
      await api.request('engagement', { method: 'POST', context: expressionId ? 'current' : 'public', body: JSON.stringify(currentlyLiked ? { action: 'unreact', contentId } : { action: 'react', contentId, reaction: 'like' }) });
      return !currentlyLiked;
    } catch (value) { setActionError(value instanceof Error ? value.message : 'Unable to update your reaction.'); return currentlyLiked; }
  };

  const handleSaveReel = async (reel: ReelWithViewerState, currentlySaved: boolean) => {
    if (mode === 'visitor') { router.push({ pathname: '/(auth)/login', params: { returnTo } } as any); return currentlySaved; }
    const contentId = reel.content_items?.id;
    if (!contentId) return currentlySaved;
    try {
      setActionError('');
      const result = await api.request<{ bookmarked: boolean }>('engagement', { method: 'POST', context: expressionId ? 'current' : 'public', body: JSON.stringify({ action: 'bookmark', contentId }) });
      return result.bookmarked;
    } catch (value) { setActionError(value instanceof Error ? value.message : 'Unable to update this bookmark.'); return currentlySaved; }
  };

  const handleShareReel = (reel: ReelWithViewerState) => {
    if (mode === 'visitor') { router.push({ pathname: '/(auth)/login', params: { returnTo } } as any); return; }
    setActionError('');
    setShareTarget(reel);
  };

  const handleReportReel = (reel: ReelWithViewerState) => {
    if (mode === 'visitor') { router.push({ pathname: '/(auth)/login', params: { returnTo } } as any); return; }
    if (!reel.content_items?.id) { setActionError('This Reel is not ready to report yet.'); return; }
    setActionError('');
    setReportTarget(reel);
  };

  const shareReelToGeneral = async () => {
    if (!shareTarget || !canShareToGeneral) return;
    const isPublic = shareTarget.content_items?.visibility === 'public';
    if (!isPublic) { setActionError('This Reel belongs to a private Expression and cannot be shared to General Community.'); setShareTarget(null); return; }
    setShareBusy(true); setActionError('');
    try {
      await api.request('social-feed', { method: 'POST', context: 'public', body: JSON.stringify({ action: 'share_reel', ...(organizationId ? { organizationId } : {}), reelId: shareTarget.id }) });
      setShareTarget(null);
    } catch (value) { setActionError(value instanceof Error ? value.message : 'Unable to share this Reel to General Community.'); }
    finally { setShareBusy(false); }
  };

  const shareReelExternally = async () => {
    if (!shareTarget) return;
    const isPublic = shareTarget.content_items?.visibility === 'public';
    if (!isPublic) { setActionError('This Reel belongs to a private Expression and cannot be shared outside it.'); setShareTarget(null); return; }
    const stream = shareTarget.media_assets?.renditions?.find((rendition) => rendition.rendition_kind === 'video_stream');
    const mediaUrl = shareTarget.media_assets?.url || stream?.playbackUrl || stream?.storage_path || null;
    const thumbnailUrl = shareTarget.media_assets?.thumbnailUrl || null;
    try {
      await shareContent({
        title: 'COT Reel',
        message: shareTarget.caption?.trim() || 'Watch this Reel from City of Transformation.',
        attachment: mediaUrl ? { url: mediaUrl, mimeType: mediaUrl.includes('.webm') ? 'video/webm' : 'video/mp4' } : thumbnailUrl ? { url: thumbnailUrl, mimeType: 'image/jpeg' } : null,
      });
      setShareTarget(null);
    } catch {
      // Dismissing the operating-system share sheet does not change Reel state.
    }
  };

  const expressionName = context?.expression?.name;

  if (initialSurfaceLoading) {
    return (
      <View style={styles.screen}>
        <Skeleton height={windowHeight} />
        <View style={[styles.loadingHeader, { top: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back from Reels" style={styles.backButton}>
            <Icon name="arrow-back" size={21} color="#FFFFFF" />
          </Pressable>
          <View style={styles.loadingPill}><Text style={styles.loadingText}>Opening Reels…</Text></View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.reelsHeader, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back from Reels" style={({ pressed }) => [styles.backButton, pressed && styles.overlayPressed]}>
          <Icon name="arrow-back" size={21} color="#FFFFFF" />
        </Pressable>

        <TourAnchor targetKey={expressionId ? 'expression.reels.scope' : 'general.reels.scope'} style={styles.scopeAnchor}>
          <View style={styles.scopePill}>
            <Icon name={expressionId ? 'lock-closed-outline' : 'globe-outline'} size={14} color="#FFFFFF" />
            <View style={styles.scopeCopy}>
              <Text style={styles.scopeLabel}>{expressionId ? 'EXPRESSION REELS' : 'GENERAL REELS'}</Text>
              <Text style={styles.scopeName} numberOfLines={1}>{expressionId ? expressionName ?? 'Members only' : 'Public COT discovery'}</Text>
            </View>
          </View>
        </TourAnchor>

        {expressionId ? (
          <Pressable onPress={() => router.push(`/expressions/${expressionId}/videos` as any)} style={({ pressed }) => [styles.headerAction, pressed && styles.overlayPressed]} accessibilityRole="button" accessibilityLabel="Open Expression media library">
            <Icon name="grid-outline" size={17} color="#FFFFFF" />
            <Text style={styles.headerActionText}>Media</Text>
          </Pressable>
        ) : mode === 'authenticated' ? (
          <Pressable onPress={() => router.push('/general/studio/reel' as any)} style={({ pressed }) => [styles.createAction, pressed && styles.overlayPressed]} accessibilityRole="button" accessibilityLabel="Create Reel">
            <Icon name="add" size={18} color="#061321" />
            <Text style={styles.createActionText}>Create</Text>
          </Pressable>
        ) : null}
      </View>

      {actionError ? <Pressable onPress={() => setActionError('')} style={[styles.errorToast, { top: insets.top + 64 }]} accessibilityRole="button" accessibilityLabel="Dismiss Reel error"><Icon name="alert-circle-outline" size={15} color="#FFFFFF" /><Text style={styles.errorToastText} numberOfLines={2}>{actionError}</Text><Icon name="close" size={14} color="rgba(255,255,255,0.86)" /></Pressable> : null}

      {reelsResource.error && !reels.length ? <View style={styles.centerWrapper}><ResourceError message={reelsResource.error} retry={reelsResource.refresh} /></View> : reels.length === 0 ? <View style={styles.centerWrapper}><ResourceError message="No Reels Yet" retry={reelsResource.refresh} /></View> : (
        <FlatList
          ref={listRef}
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          getItemLayout={(_, index) => ({ length: windowHeight, offset: windowHeight * index, index })}
          showsVerticalScrollIndicator={false}
          snapToInterval={windowHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          updateCellsBatchingPeriod={80}
          removeClippedSubviews={Platform.OS === 'android'}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={reelsResource.refreshing} onRefresh={reelsResource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item, index }) => <ReelPlayer reel={item} expressionName={expressionName} isActive={index === activeIndex} initialLiked={Boolean(item.viewerReaction)} initialSaved={item.viewerBookmarked === true} onLike={(currentlyLiked) => handleLikeReel(item, currentlyLiked)} onSave={(currentlySaved) => handleSaveReel(item, currentlySaved)} onOpenComments={() => handleOpenComments(item)} onShare={() => handleShareReel(item)} onReport={() => handleReportReel(item)} onPressCreator={item.content_items?.author?.username ? () => router.push({ pathname: '/general/member/[username]', params: { username: item.content_items!.author!.username! } } as any) : undefined} containerHeight={windowHeight} />}
        />
      )}

      <BottomSheet visible={!!shareTarget} onClose={() => { if (!shareBusy) setShareTarget(null); }} title="Share Reel" subtitle={shareTarget?.caption || 'Choose where to share this Reel.'}>
        <View style={styles.shareSheet}>
          {shareTarget?.content_items?.visibility === 'public' ? <>{canShareToGeneral ? <Button label="Share to General Community" onPress={() => void shareReelToGeneral()} loading={shareBusy} variant="primary" size="lg" fullWidth /> : null}<Button label="Share externally" onPress={() => void shareReelExternally()} disabled={shareBusy} variant="outline" size="lg" fullWidth /></> : <View style={styles.privateShareNotice}><Icon name="lock-closed-outline" size={20} color="#FFFFFF" /><Text style={styles.privateShareText}>This Reel is private to its Expression and cannot be shared outside that space.</Text></View>}
        </View>
      </BottomSheet>

      <ContentReportSheet target={reportTarget?.content_items?.id ? { contentId: reportTarget.content_items.id, context: expressionId ? 'current' : 'public', label: reportTarget.caption ? `Report Reel: ${reportTarget.caption}` : 'Report this Reel' } : null} onClose={() => setReportTarget(null)} />
    </View>
  );
}

export default function GeneralReelsExperience() { return <ReelsExperience scope="general" />; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  reelsHeader: { position: 'absolute', left: 12, right: 12, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingHeader: { position: 'absolute', left: 12, right: 12, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,12,24,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scopeAnchor: { flex: 1 },
  scopePill: { minHeight: 46, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(4,12,24,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scopeCopy: { flex: 1, minWidth: 0 },
  scopeLabel: { color: '#FFFFFF', fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 0.75 },
  scopeName: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 1 },
  headerAction: { minHeight: 46, borderRadius: 18, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(4,12,24,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  headerActionText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  createAction: { minHeight: 46, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' },
  createActionText: { color: '#061321', fontSize: 10.5, fontWeight: '900' },
  loadingPill: { minHeight: 46, flex: 1, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: 'rgba(4,12,24,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  loadingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  overlayPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  errorToast: { position: 'absolute', left: 12, right: 12, zIndex: 40, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, backgroundColor: 'rgba(180,35,24,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  errorToastText: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  centerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  shareSheet: { gap: 12 },
  privateShareNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  privateShareText: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 18, fontWeight: '600' },
});