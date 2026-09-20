import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Icon, ScreenHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { DailyDevotionalPayload } from './library-types';

function today() { return new Date().toISOString().slice(0, 10); }
function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function prettyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

export function DevotionalExperience() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const [date, setDate] = useState(today());
  const [dateInput, setDateInput] = useState(date);
  const [speaking, setSpeaking] = useState(false);
  const devotional = useResource<DailyDevotionalPayload | null>(
    `devotional:${organizationId || 'public'}:${date}`,
    (signal) => api.request<DailyDevotionalPayload | null>(
      `library?view=devotional&date=${date}${organizationId ? `&organizationId=${organizationId}` : ''}`,
      { signal, context: 'public' },
    ),
  );

  useEffect(() => { setDateInput(date); void Speech.stop(); setSpeaking(false); }, [date]);
  useEffect(() => () => { void Speech.stop(); }, []);

  const speak = () => {
    const data = devotional.data;
    if (!data) return;
    if (speaking) { void Speech.stop(); setSpeaking(false); return; }
    const text = [data.entry.title, data.entry.scripture, data.entry.memory_verse, data.entry.body, data.entry.prayer].filter(Boolean).join('. ');
    setSpeaking(true);
    Speech.speak(text, { rate: 0.92, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  const applyDate = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput) && !Number.isNaN(new Date(`${dateInput}T12:00:00Z`).getTime())) setDate(dateInput);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 100 }]}>
        <ScreenHeader title='Daily Devotional' showBack compact />
        <View style={[styles.dateBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Pressable onPress={() => setDate(shiftDate(date, -1))} style={styles.round}><Icon name='chevron-back' size={18} color={colors.text} /></Pressable>
          <View style={styles.dateCopy}><Text style={[styles.dateTitle, { color: colors.text }]}>{prettyDate(date)}</Text><Text style={[styles.dateMeta, { color: colors.textMuted }]}>Year · month · day reading</Text></View>
          <Pressable onPress={() => setDate(shiftDate(date, 1))} style={styles.round}><Icon name='chevron-forward' size={18} color={colors.text} /></Pressable>
        </View>

        <View style={styles.jumpRow}>
          <View style={[styles.dateInputWrap, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Icon name='calendar-outline' size={16} color={colors.textMuted} />
            <TextInput value={dateInput} onChangeText={setDateInput} onSubmitEditing={applyDate} placeholder='YYYY-MM-DD' placeholderTextColor={colors.textMuted} style={[styles.dateInput, { color: colors.text }]} />
          </View>
          <Pressable onPress={applyDate} style={[styles.go, { backgroundColor: colors.text }]}><Text style={[styles.goText, { color: colors.bg }]}>Go</Text></Pressable>
          {date !== today() ? <Pressable onPress={() => setDate(today())} style={[styles.today, { borderColor: colors.borderSubtle }]}><Text style={[styles.todayText, { color: colors.interactive }]}>Today</Text></Pressable> : null}
        </View>

        {devotional.loading && devotional.data === undefined ? (
          <View style={styles.loading}><Skeleton height={38} width='55%' borderRadius={12} /><Skeleton height={460} borderRadius={22} /></View>
        ) : devotional.error ? (
          <Pressable onPress={devotional.refresh}><EmptyState title='Devotional unavailable' message='Tap to try again.' iconName='refresh-outline' /></Pressable>
        ) : !devotional.data ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Icon name='calendar-clear-outline' size={34} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No devotional for this date</Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Choose another day. Ministry publishers can add or map daily readings from a devotional book.</Text>
          </View>
        ) : (
          <>
            <View style={styles.seriesHead}>
              <View style={styles.flex}><Text style={[styles.seriesTitle, { color: colors.text }]}>{devotional.data.series.title}</Text><Text style={[styles.seriesMeta, { color: colors.textSecondary }]}>{devotional.data.series.author_name || `${devotional.data.series.devotional_year} devotional`}</Text></View>
              <Pressable onPress={speak} style={[styles.listen, { backgroundColor: speaking ? colors.primarySoft : colors.card, borderColor: colors.borderSubtle }]}><Icon name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={17} color={colors.interactive} /><Text style={[styles.listenText, { color: colors.interactive }]}>{speaking ? 'Stop' : 'Listen'}</Text></Pressable>
            </View>
            <View style={[styles.paper, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <Text style={[styles.entryDate, { color: colors.interactive }]}>{prettyDate(devotional.data.entry.devotional_date).toUpperCase()}</Text>
              <Text style={[styles.entryTitle, { color: colors.text }]}>{devotional.data.entry.title || 'Today’s Devotional'}</Text>
              {devotional.data.entry.scripture ? <View style={[styles.scripture, { backgroundColor: colors.bgSecondary }]}><Text style={[styles.kicker, { color: colors.textMuted }]}>SCRIPTURE</Text><Text style={[styles.scriptureText, { color: colors.text }]}>{devotional.data.entry.scripture}</Text></View> : null}
              {devotional.data.entry.memory_verse ? <View style={styles.block}><Text style={[styles.kicker, { color: colors.textMuted }]}>MEMORY VERSE</Text><Text style={[styles.verse, { color: colors.text }]}>{devotional.data.entry.memory_verse}</Text></View> : null}
              <Text style={[styles.body, { color: colors.text }]}>{devotional.data.entry.body}</Text>
              {devotional.data.entry.prayer ? <View style={[styles.prayer, { borderColor: colors.borderSubtle }]}><Icon name='heart-outline' size={18} color={colors.interactive} /><View style={styles.flex}><Text style={[styles.kicker, { color: colors.textMuted }]}>PRAYER / REFLECTION</Text><Text style={[styles.prayerText, { color: colors.text }]}>{devotional.data.entry.prayer}</Text></View></View> : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1},content:{flexGrow:1,paddingHorizontal:spacing.md,gap:spacing.lg,maxWidth:820,width:'100%',alignSelf:'center'},
  dateBar:{minHeight:66,borderWidth:1,borderRadius:radius.xl,flexDirection:'row',alignItems:'center',paddingHorizontal:spacing.sm,gap:6},
  round:{width:40,height:40,alignItems:'center',justifyContent:'center'},dateCopy:{flex:1,alignItems:'center'},dateTitle:{fontSize:14,fontWeight:'900',textAlign:'center'},dateMeta:{fontSize:9.5,marginTop:2},
  jumpRow:{flexDirection:'row',alignItems:'center',gap:7},dateInputWrap:{flex:1,minHeight:40,borderWidth:1,borderRadius:20,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:11},dateInput:{flex:1,fontSize:12,paddingVertical:8},go:{height:40,minWidth:48,borderRadius:20,alignItems:'center',justifyContent:'center'},goText:{fontSize:10,fontWeight:'900'},today:{height:40,borderWidth:1,borderRadius:20,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},todayText:{fontSize:10,fontWeight:'900'},
  loading:{gap:spacing.md},emptyCard:{minHeight:280,borderWidth:1,borderRadius:radius.xl,alignItems:'center',justifyContent:'center',padding:spacing.xl,gap:8},emptyTitle:{fontSize:18,fontWeight:'900'},emptyCopy:{fontSize:12,lineHeight:18,textAlign:'center',maxWidth:380},
  seriesHead:{flexDirection:'row',alignItems:'center',gap:spacing.md},seriesTitle:{fontSize:17,fontWeight:'900'},seriesMeta:{fontSize:11,marginTop:2},flex:{flex:1,minWidth:0},
  listen:{height:38,borderWidth:1,borderRadius:19,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:5},listenText:{fontSize:10,fontWeight:'900'},
  paper:{borderWidth:1,borderRadius:22,padding:24,gap:20},entryDate:{fontSize:9.5,fontWeight:'900',letterSpacing:1.2},entryTitle:{fontSize:26,lineHeight:32,fontWeight:'900',letterSpacing:-0.5},
  scripture:{borderRadius:radius.lg,padding:spacing.md,gap:6},kicker:{fontSize:9,fontWeight:'900',letterSpacing:0.9},scriptureText:{fontSize:15,lineHeight:22,fontWeight:'800'},block:{gap:6},verse:{fontSize:15,lineHeight:23,fontStyle:'italic'},
  body:{fontSize:16,lineHeight:28},prayer:{borderTopWidth:1,paddingTop:18,flexDirection:'row',gap:10},prayerText:{fontSize:14,lineHeight:22,marginTop:5},
});
