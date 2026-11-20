import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { useGeneralMinistryAccess } from '@/features/general/useGeneralMinistryAccess';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  LeaderCard,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { ChurchStory, LeadershipProfile } from '@church/types';
import { LocationFinder, type VerifiedLocationResult } from '@/components/location/LocationFinder';
import GeneralChurchLeadershipPanel from '@/features/general/GeneralChurchLeadershipPanel';

type PublicLocation = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  landmark?: string | null;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

interface StoryResponse {
  story: ChurchStory | null;
  leadership: LeadershipProfile[];
  location?: PublicLocation | null;
}

function locationLines(location?: PublicLocation | null) {
  if (!location) return [];
  return [
    location.line1,
    location.line2,
    [location.city, location.state].filter(Boolean).join(', '),
    location.country,
  ].map((value) => String(value || '').trim()).filter(Boolean);
}

function TextCard({ kicker, text, secondary = false }: { kicker: string; text: string; secondary?: boolean }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
      <View style={styles.cardHeadingRow}>
        <Text style={[styles.cardKicker, { color: colors.interactive }]}>{kicker}</Text>
        <Pressable
          onPress={async () => {
            await Clipboard.setStringAsync(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          style={({ pressed }) => [styles.copyButton, { backgroundColor: colors.bgSecondary }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${kicker.toLowerCase()}`}
        >
          <Icon name={copied ? 'checkmark-outline' : 'copy-outline'} size={13} color={colors.interactive} />
          <Text style={[styles.copyText, { color: colors.textSecondary }]}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>
      <Text style={[styles.cardBody, { color: secondary ? colors.textSecondary : colors.text }]}>{text}</Text>
    </View>
  );
}

export default function ChurchStoryScreen() {
  const insets = useSafeAreaInsets();
  const routeParams = useLocalSearchParams<{ edit?: string; manage?: string; tab?: string }>();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const requestedTab = routeParams.tab === 'facts' ? 'facts' : routeParams.tab === 'leadership' ? 'leadership' : 'story';
  const [activeTab, setActiveTab] = useState<'story' | 'facts' | 'leadership'>(requestedTab);
  const [editing, setEditing] = useState(false);
  const [savingStory, setSavingStory] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!access.canManageLeadership) return;
    if (routeParams.edit === 'leaders' || routeParams.edit === 'leadership') {
      setActiveTab('leadership');
      setEditing(true);
      return;
    }
    if (routeParams.edit === 'facts') {
      setActiveTab('facts');
      setEditing(true);
      return;
    }
    if (routeParams.edit === 'location' || routeParams.edit === 'story') {
      setActiveTab('story');
      setEditing(true);
      return;
    }
    if (routeParams.tab === 'facts' || routeParams.tab === 'leadership' || routeParams.tab === 'story') {
      setActiveTab(routeParams.tab);
    }
    if (routeParams.manage === '1') setEditing(true);
  }, [routeParams.edit, routeParams.manage, routeParams.tab, access.canManageLeadership]);

  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const orgParam = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

  const resource = useResource<StoryResponse>(`church:story:public:${organizationId || 'auto'}`, (signal) =>
    api.request(`church-story${orgParam}`, { signal })
  );

  const story = resource.data?.story;
  const leaders = resource.data?.leadership ?? [];
  const location = resource.data?.location ?? null;

  const [title, setTitle] = useState('Our Story');
  const [subtitle, setSubtitle] = useState('');
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [foundingStory, setFoundingStory] = useState('');
  const [foundingYear, setFoundingYear] = useState('');
  const [quickFacts, setQuickFacts] = useState<string[]>(Array.from({ length: 7 }, () => ''));
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [landmark, setLandmark] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [manualLocation, setManualLocation] = useState(false);

  useEffect(() => {
    setTitle(story?.title || 'Our Story');
    setSubtitle(story?.subtitle || '');
    setMission(story?.mission || '');
    setVision(story?.vision || '');
    setFoundingStory(story?.founding_story || '');
    setFoundingYear(story?.founding_year ? String(story.founding_year) : '');
    const savedFacts = Array.isArray(story?.quick_facts) ? story.quick_facts.slice(0, 7) : [];
    setQuickFacts(Array.from({ length: 7 }, (_, index) => savedFacts[index] ?? ''));
  }, [story?.id, story?.updated_at]);

  useEffect(() => {
    setLine1(location?.line1 || '');
    setLine2(location?.line2 || '');
    setCity(location?.city || '');
    setState(location?.state || '');
    setCountry(location?.country || 'Nigeria');
    setLandmark(location?.landmark || '');
    setMapUrl(location?.mapUrl || '');
    setLatitude(typeof location?.latitude === 'number' ? location.latitude : null);
    setLongitude(typeof location?.longitude === 'number' ? location.longitude : null);
    setManualLocation(Boolean(location && (typeof location.latitude !== 'number' || typeof location.longitude !== 'number')));
  }, [location?.line1, location?.line2, location?.city, location?.state, location?.country, location?.landmark, location?.mapUrl, location?.latitude, location?.longitude]);

  const hasStoryContent = Boolean(
    story && (story.mission || story.vision || story.founding_story || story.values?.length || story.history_milestones?.length)
  );
  const addressLines = useMemo(() => locationLines(location), [location]);
  const locationText = [addressLines.join('\n'), location?.landmark ? `Landmark: ${location.landmark}` : ''].filter(Boolean).join('\n');

  const saveStory = async () => {
    if (!title.trim()) return setError('Enter a title for Our Story.');
    setSavingStory(true); setError(''); setFeedback('');
    try {
      await api.request('church-story', {
        method: 'POST',
        body: JSON.stringify({
          type: 'story',
          title: title.trim(),
          subtitle: subtitle.trim(),
          mission: mission.trim(),
          vision: vision.trim(),
          foundingStory: foundingStory.trim(),
          foundingYear: foundingYear.trim() || null,
          milestones: story?.history_milestones ?? [],
          quickFacts: quickFacts.map((item) => item.trim()).filter(Boolean).slice(0, 7),
          values: story?.values ?? [],
          bannerImageUrl: story?.banner_image_url || undefined,
        }),
      });
      setFeedback(activeTab === 'facts' ? 'Quick Facts were published.' : 'Our Story was published.');
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We couldn’t publish Our Story.');
    } finally { setSavingStory(false); }
  };

  const applyVerifiedLocation = (result: VerifiedLocationResult) => {
    setLine1(result.line1 || result.label);
    setLine2(result.line2 || '');
    setCity(result.city || '');
    setState(result.state || '');
    setCountry(result.country || 'Nigeria');
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setMapUrl(result.mapUrl);
    setManualLocation(false);
  };

  const useManualLocation = () => {
    setManualLocation(true);
    setLatitude(null);
    setLongitude(null);
    setMapUrl('');
  };

  const updateQuickFact = (index: number, value: string) => {
    setQuickFacts((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const saveLocation = async () => {
    setSavingLocation(true); setError(''); setFeedback('');
    try {
      await api.request('church-story', {
        method: 'POST',
        body: JSON.stringify({
          type: 'location',
          location: {
            line1: line1.trim(), line2: line2.trim(), city: city.trim(), state: state.trim(),
            country: country.trim(), landmark: landmark.trim(), mapUrl: mapUrl.trim() || null,
            latitude, longitude,
          },
        }),
      });
      setFeedback('General COT location was published.');
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We couldn’t save the General COT location.');
    } finally { setSavingLocation(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title={story?.title ?? 'Our Story'}
            kicker="COT"
            subtitle={story?.subtitle ?? 'Our Story, Quick Facts, church location and Our Leaders.'}
            showBack
          />
          {access.canManageLeadership ? (
            <View style={styles.adminActions}>
              <Button
                label={editing ? 'Done managing' : 'Manage church profile'}
                onPress={() => {
                  if (editing) {
                    setEditing(false);
                    router.replace({ pathname: '/general/church-story', params: { tab: activeTab } } as any);
                  } else {
                    setEditing(true);
                    router.replace({ pathname: '/general/church-story', params: { manage: '1', tab: activeTab } } as any);
                  }
                }}
                variant={editing ? 'outline' : 'primary'}
                size="sm"
              />
            </View>
          ) : null}
        </View>

        {feedback ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle-outline" size={17} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{feedback}</Text></View> : null}
        {error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={17} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}

        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Chip label="Our Story" selected={activeTab === 'story'} onPress={() => {
            setActiveTab('story');
            if (editing) router.replace({ pathname: '/general/church-story', params: { manage: '1', tab: 'story' } } as any);
          }} />
          <Chip label="Quick Facts" selected={activeTab === 'facts'} onPress={() => {
            setActiveTab('facts');
            if (editing) router.replace({ pathname: '/general/church-story', params: { manage: '1', tab: 'facts' } } as any);
          }} count={(story?.quick_facts ?? []).length} />
          <Chip label="Our Leaders" selected={activeTab === 'leadership'} onPress={() => {
            setActiveTab('leadership');
            if (editing) router.replace({ pathname: '/general/church-story', params: { manage: '1', tab: 'leadership' } } as any);
          }} count={leaders.length} />
        </View>

        {editing && access.canManageLeadership ? (
          <View style={styles.editorWrap}>
            {activeTab === 'story' ? (
              <>
                <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.editorHeading}>
                    <View style={[styles.editorIcon, { backgroundColor: colors.primarySoft }]}><Icon name="library-outline" size={18} color={colors.interactive} /></View>
                    <View style={styles.flex}>
                      <Text style={[styles.editorTitle, { color: colors.text }]}>Manage Our Story</Text>
                      <Text style={[styles.editorHint, { color: colors.textSecondary }]}>Update the church story members and visitors read here.</Text>
                    </View>
                  </View>
                  <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Our Story" />
                  <InputField label="Subtitle" value={subtitle} onChangeText={setSubtitle} placeholder="City of Transformation" />
                  <InputField label="Mission" value={mission} onChangeText={setMission} multiline numberOfLines={4} placeholder="What COT exists to do…" />
                  <InputField label="Vision" value={vision} onChangeText={setVision} multiline numberOfLines={4} placeholder="Where COT is going…" />
                  <InputField label="Founding story" value={foundingStory} onChangeText={setFoundingStory} multiline numberOfLines={8} placeholder="Tell the COT founding story…" />
                  <InputField label="Founding year (optional)" value={foundingYear} onChangeText={setFoundingYear} keyboardType="number-pad" placeholder="2010" />
                  <Button label="Save Our Story" onPress={() => void saveStory()} loading={savingStory} size="md" />
                </View>

                <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.editorHeading}>
                    <View style={[styles.editorIcon, { backgroundColor: colors.primarySoft }]}><Icon name="location-outline" size={18} color={colors.interactive} /></View>
                    <View style={styles.flex}>
                      <Text style={[styles.editorTitle, { color: colors.text }]}>Church location</Text>
                      <Text style={[styles.editorHint, { color: colors.textSecondary }]}>Publish the official General COT address. Expression addresses remain in each Expression’s settings.</Text>
                    </View>
                  </View>
                  <LocationFinder
                    initialLabel={addressLines.join(', ')}
                    onSelect={applyVerifiedLocation}
                    onManualFallback={useManualLocation}
                  />
                  {!manualLocation && latitude !== null && longitude !== null ? (
                    <View style={[styles.verifiedLocation, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
                      <Icon name="checkmark-circle-outline" size={18} color={colors.success} />
                      <View style={styles.flex}>
                        <Text style={[styles.verifiedTitle, { color: colors.text }]}>Location confirmed</Text>
                        <Text style={[styles.editorHint, { color: colors.textSecondary }]}>{[line1, line2, city, state, country].filter(Boolean).join(', ')}</Text>
                      </View>
                    </View>
                  ) : null}
                  {manualLocation ? (
                    <View style={[styles.manualLocation, { borderColor: colors.borderSubtle }]}>
                      <Text style={[styles.editorTitle, { color: colors.text }]}>Enter address manually</Text>
                      <Text style={[styles.editorHint, { color: colors.textSecondary }]}>Use this when the location search cannot find the address.</Text>
                      <InputField label="Street / building" value={line1} onChangeText={setLine1} placeholder="Street name and building" />
                      <InputField label="Address line 2 (optional)" value={line2} onChangeText={setLine2} placeholder="Area, floor or suite" />
                      <View style={styles.twoCol}>
                        <View style={styles.flex}><InputField label="City" value={city} onChangeText={setCity} placeholder="Awka" /></View>
                        <View style={styles.flex}><InputField label="State" value={state} onChangeText={setState} placeholder="Anambra" /></View>
                      </View>
                      <InputField label="Country" value={country} onChangeText={setCountry} placeholder="Nigeria" />
                    </View>
                  ) : null}
                  <InputField label="Landmark (optional)" value={landmark} onChangeText={setLandmark} placeholder="Near…" />
                  <Button label="Save Church Location" onPress={() => void saveLocation()} loading={savingLocation} size="md" />
                </View>
              </>
            ) : activeTab === 'facts' ? (
              <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.editorHeading}>
                  <View style={[styles.editorIcon, { backgroundColor: colors.primarySoft }]}><Icon name="flash-outline" size={18} color={colors.interactive} /></View>
                  <View style={styles.flex}>
                    <Text style={[styles.editorTitle, { color: colors.text }]}>Manage Quick Facts</Text>
                    <Text style={[styles.editorHint, { color: colors.textSecondary }]}>Add up to seven concise facts people should know about General COT.</Text>
                  </View>
                </View>
                {quickFacts.map((fact, index) => (
                  <InputField key={index} label={`Quick fact ${index + 1}`} value={fact} onChangeText={(value) => updateQuickFact(index, value)} placeholder={`Fact ${index + 1}`} />
                ))}
                <Button label="Save Quick Facts" onPress={() => void saveStory()} loading={savingStory} size="md" />
              </View>
            ) : (
              <GeneralChurchLeadershipPanel />
            )}
          </View>
        ) : (
          <View style={styles.body}>
          {resource.loading ? (
            <View style={{ gap: spacing.md }}><Skeleton height={120} borderRadius={radius.lg} /><Skeleton height={160} borderRadius={radius.lg} /></View>
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : activeTab === 'story' ? (
            <View style={styles.storySection}>
              {locationText ? (
                <View style={[styles.locationCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
                  <View style={[styles.locationIcon, { backgroundColor: colors.card }]}><Icon name="location" size={19} color={colors.interactive} /></View>
                  <View style={styles.flex}><Text style={[styles.locationKicker, { color: colors.interactive }]}>GENERAL COT LOCATION</Text><Text style={[styles.locationText, { color: colors.text }]}>{addressLines.join(', ')}</Text>{location?.landmark ? <Text style={[styles.locationHint, { color: colors.textSecondary }]}>Landmark: {location.landmark}</Text> : null}</View>
                  <Pressable onPress={() => void Clipboard.setStringAsync(locationText)} style={styles.locationCopy} accessibilityRole="button" accessibilityLabel="Copy church location"><Icon name="copy-outline" size={16} color={colors.interactive} /></Pressable>
                </View>
              ) : null}

              {hasStoryContent ? (
                <>
                  {story?.mission ? <TextCard kicker="OUR MISSION" text={story.mission} /> : null}
                  {story?.vision ? <TextCard kicker="OUR VISION" text={story.vision} /> : null}
                  {story?.founding_story ? <TextCard kicker={`FOUNDING HERITAGE ${story.founding_year ? `(${story.founding_year})` : ''}`} text={story.founding_story} secondary /> : null}
                  {story?.values && story.values.length > 0 ? (
                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                      <Text style={[styles.cardKicker, { color: colors.interactive }]}>CORE VALUES</Text>
                      <View style={styles.valuesList}>
                        {story.values.map((val, idx) => (
                          <View key={idx} style={[styles.valueBlock, { backgroundColor: colors.bgSecondary }]}>
                            <Text style={[styles.valueTitle, { color: colors.text }]}>{val.title}</Text>
                            {val.description ? <Text style={[styles.valueDesc, { color: colors.textSecondary }]}>{val.description}</Text> : null}
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : !locationText ? (
                <EmptyState title="Story Not Published Yet" message="Authorized General COT leadership can create and publish mission, vision, heritage and location here." iconName="library-outline" />
              ) : null}
            </View>
          ) : activeTab === 'facts' ? (
            (story?.quick_facts ?? []).length ? (
              <View style={styles.factsList}>
                {(story?.quick_facts ?? []).map((fact, index) => (
                  <View key={`${index}:${fact}`} style={[styles.factCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                    <View style={[styles.factNumber, { backgroundColor: colors.primarySoft }]}><Text style={[styles.factNumberText, { color: colors.interactive }]}>{index + 1}</Text></View>
                    <Text style={[styles.factText, { color: colors.text }]}>{fact}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="Quick Facts not published yet" message="Authorized General COT leadership can publish up to seven concise public facts here." iconName="flash-outline" />
            )
          ) : leaders.length > 0 ? (
            <View style={styles.leadersList}>{leaders.map((leader) => <LeaderCard key={leader.id} leader={leader} variant="standard" />)}</View>
          ) : (
            <EmptyState title="No Leaders Listed" message="Leadership profiles will appear here once configured by pastoral administration." iconName="people-outline" />
          )}
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, flex: { flex: 1, minWidth: 0 },
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  adminActions: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, alignItems: 'flex-start' },
  notice: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  editorWrap: { marginHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.md },
  editorCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  editorHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, editorIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  editorTitle: { fontSize: 14, fontWeight: '900' }, editorHint: { fontSize: 10.5, lineHeight: 15, marginTop: 2 }, twoCol: { flexDirection: 'row', gap: spacing.sm },
  tabContainer: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, padding: 5, gap: spacing.xs, borderWidth: 1, borderRadius: radius.xl, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm }, storySection: { gap: spacing.md },
  sectionCard: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, gap: 6 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, cardKicker: { ...typography.kicker }, cardBody: { ...typography.body, lineHeight: 22 },
  copyButton: { minHeight: 30, borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 }, copyText: { fontSize: 9.5, fontWeight: '800' }, pressed: { opacity: 0.82 },
  locationCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  locationIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, locationKicker: { ...typography.kicker }, locationText: { fontSize: 13.5, lineHeight: 19, fontWeight: '800', marginTop: 3 }, locationHint: { fontSize: 11, lineHeight: 16, marginTop: 3 }, locationCopy: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  valuesList: { gap: spacing.sm, marginTop: spacing.xs }, valueBlock: { padding: spacing.md, borderRadius: radius.lg, gap: 2 }, valueTitle: { fontSize: 14, fontWeight: '700' }, valueDesc: { fontSize: 12, lineHeight: 16 },
  leadersList: { gap: spacing.xs },
  quickFactsEditor: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  verifiedLocation: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  verifiedTitle: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  manualLocation: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  factsList: { gap: spacing.sm },
  factCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  factNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  factNumberText: { fontSize: 12, fontWeight: '900' },
  factText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '650' as any },
});