import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, Icon, InputField, ScreenHeader, Skeleton } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { DevotionalSeries, LibraryBook } from './library-types';

type ManagePayload={series:DevotionalSeries[];books:Array<Pick<LibraryBook,'id'|'title'|'author_name'|'source_format'|'status'>>};
function today(){return new Date().toISOString().slice(0,10);}

export function DevotionalManageExperience(){
 const insets=useSafeAreaInsets();
 const {api,context,hasOrganizationCapability}=useSession();
 const {colors}=useTheme();
 const organizationId=context?.organization?.id??context?.organizations?.[0]?.id??'';
 const endpoint=`noop?service=library${organizationId?`&organizationId=${organizationId}`:''}`;
 const canPublish=hasOrganizationCapability('sermons.publish');
 const resource=useResource<ManagePayload>(`devotional:manage:${organizationId||'none'}`,(signal)=>api.request<ManagePayload>(`noop?service=library&view=devotional_manage${organizationId?`&organizationId=${organizationId}`:''}`,{signal,context:'public'}));

 const [title,setTitle]=useState('');
 const [author,setAuthor]=useState('');
 const [year,setYear]=useState(String(new Date().getFullYear()));
 const [bookId,setBookId]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [editingSeries,setEditingSeries]=useState<DevotionalSeries|null>(null);
 const [entryDate,setEntryDate]=useState(today());
 const [entryTitle,setEntryTitle]=useState('');
 const [scripture,setScripture]=useState('');
 const [memoryVerse,setMemoryVerse]=useState('');
 const [body,setBody]=useState('');
 const [prayer,setPrayer]=useState('');

 const createSeries=async()=>{
  if(busy)return;
  if(!title.trim()){setError('Add a devotional title.');return;}
  const numericYear=Number(year);
  if(!Number.isInteger(numericYear)||numericYear<2000||numericYear>2200){setError('Enter a valid devotional year.');return;}
  setBusy(true);setError('');setSuccess('');
  try{
   await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'create_devotional_series',title:title.trim(),authorName:author.trim(),year:numericYear,bookId:bookId||undefined})});
   setTitle('');setAuthor('');setBookId('');setSuccess('Devotional series created.');resource.refresh();
  }catch(value){setError(value instanceof Error?value.message:'Unable to create the devotional.');}
  finally{setBusy(false);}
 };
 const importBook=async(series:DevotionalSeries)=>{
  setBusy(true);setError('');setSuccess('');
  try{
   const result=await api.request<{mapped:number;totalChapters:number}>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'import_devotional_from_book',seriesId:series.id})});
   setSuccess(`Mapped ${result.mapped} dated chapter${result.mapped===1?'':'s'} from ${result.totalChapters} chapters. Review missing dates manually.`);
  }catch(value){setError(value instanceof Error?value.message:'Unable to import dated chapters.');}
  finally{setBusy(false);}
 };
 const publish=async(series:DevotionalSeries)=>{
  setBusy(true);setError('');
  try{await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'publish_devotional_series',seriesId:series.id})});setSuccess('Devotional published.');resource.refresh();}
  catch(value){setError(value instanceof Error?value.message:'Unable to publish the devotional.');}
  finally{setBusy(false);}
 };
 const openEntry=(series:DevotionalSeries)=>{
  setEditingSeries(series);setEntryDate(`${series.devotional_year}-01-01`);setEntryTitle('');setScripture('');setMemoryVerse('');setBody('');setPrayer('');setError('');
 };
 const saveEntry=async()=>{
  if(!editingSeries||busy)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)||Number(entryDate.slice(0,4))!==editingSeries.devotional_year){setError(`Use a date inside ${editingSeries.devotional_year}.`);return;}
  if(!body.trim()){setError('Add the devotional reading for this day.');return;}
  setBusy(true);setError('');setSuccess('');
  try{
   await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'upsert_devotional_entry',seriesId:editingSeries.id,date:entryDate,title:entryTitle.trim(),scripture:scripture.trim(),memoryVerse:memoryVerse.trim(),body:body.trim(),prayer:prayer.trim()})});
   setSuccess(`Saved the reading for ${entryDate}.`);setEntryTitle('');setScripture('');setMemoryVerse('');setBody('');setPrayer('');
  }catch(value){setError(value instanceof Error?value.message:'Unable to save this daily reading.');}
  finally{setBusy(false);}
 };

 return <View style={[styles.screen,{backgroundColor:colors.bg}]}>
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingTop:insets.top+spacing.sm,paddingBottom:insets.bottom+110}]}>
   <ScreenHeader title='Devotional management' showBack compact />
   <View style={[styles.form,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}>
    <View><Text style={[styles.title,{color:colors.text}]}>Create yearly devotional</Text><Text style={[styles.copy,{color:colors.textSecondary}]}>Attach an EPUB devotional book to map chapters titled with dates such as “January 1”. You can fill or correct any day manually.</Text></View>
    <InputField label='Devotional title' value={title} onChangeText={setTitle} placeholder='COT Daily Devotional 2027'/>
    <InputField label='Author / ministry' value={author} onChangeText={setAuthor} placeholder='Author or church ministry'/>
    <InputField label='Year' value={year} onChangeText={setYear} keyboardType='number-pad' placeholder='2027'/>
    <View style={styles.bookPicker}><Text style={[styles.label,{color:colors.text}]}>Attach Library book (optional)</Text><View style={styles.chips}><Chip label='None / manual' selected={!bookId} onPress={()=>setBookId('')}/>{(resource.data?.books??[]).filter((book)=>book.source_format==='epub').map((book)=><Chip key={book.id} label={book.title} selected={bookId===book.id} onPress={()=>setBookId(book.id)}/>)}</View></View>
    <Button label={busy?'Creating…':'Create devotional'} disabled={busy} onPress={()=>void createSeries()}/>
   </View>

   {error?<Text style={[styles.feedback,{color:colors.live}]}>{error}</Text>:null}{success?<Text style={[styles.feedback,{color:colors.interactive}]}>{success}</Text>:null}

   <View style={styles.section}><Text style={[styles.sectionTitle,{color:colors.text}]}>Devotional series</Text>
    {resource.loading&&!resource.data?<Skeleton height={180} borderRadius={18}/>:!resource.data?.series.length?<EmptyState title='No devotional series yet' message='Create the first yearly or monthly devotional above.' iconName='sunny-outline'/>:(resource.data?.series??[]).map((series)=>{
      const attached=resource.data?.books.find((book)=>book.id===series.book_id);
      return <View key={series.id} style={[styles.seriesCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}>
       <View style={styles.seriesHead}><View style={styles.flex}><Text style={[styles.seriesTitle,{color:colors.text}]}>{series.title}</Text><Text style={[styles.seriesMeta,{color:colors.textSecondary}]}>{series.devotional_year}{series.author_name?` · ${series.author_name}`:''} · {series.status}</Text>{attached?<Text style={[styles.attached,{color:colors.textMuted}]}>Book: {attached.title}</Text>:null}</View><View style={[styles.yearBadge,{backgroundColor:colors.bgSecondary}]}><Text style={[styles.yearText,{color:colors.text}]}>{series.devotional_year}</Text></View></View>
       <View style={styles.actions}>{series.book_id?<Pressable disabled={busy} onPress={()=>void importBook(series)} style={[styles.action,{borderColor:colors.borderSubtle}]}><Icon name='sparkles-outline' size={14} color={colors.interactive}/><Text style={[styles.actionText,{color:colors.textSecondary}]}>Map dated chapters</Text></Pressable>:null}<Pressable onPress={()=>openEntry(series)} style={[styles.action,{borderColor:colors.borderSubtle}]}><Icon name='calendar-outline' size={14} color={colors.interactive}/><Text style={[styles.actionText,{color:colors.textSecondary}]}>Add day</Text></Pressable>{series.status==='draft'&&canPublish?<Pressable disabled={busy} onPress={()=>void publish(series)} style={[styles.action,{borderColor:colors.interactive,backgroundColor:colors.primarySoft}]}><Text style={[styles.actionText,{color:colors.interactive}]}>Publish</Text></Pressable>:null}</View>
      </View>;
    })}
   </View>

   {editingSeries?<View style={[styles.entryForm,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}>
    <View style={styles.entryHead}><View style={styles.flex}><Text style={[styles.title,{color:colors.text}]}>Daily entry</Text><Text style={[styles.copy,{color:colors.textSecondary}]}>{editingSeries.title} · {editingSeries.devotional_year}</Text></View><Pressable onPress={()=>setEditingSeries(null)} style={styles.close}><Icon name='close' size={18} color={colors.text}/></Pressable></View>
    <InputField label='Date (YYYY-MM-DD)' value={entryDate} onChangeText={setEntryDate} placeholder={`${editingSeries.devotional_year}-01-01`}/>
    <InputField label='Title' value={entryTitle} onChangeText={setEntryTitle} placeholder='Today’s title'/>
    <InputField label='Scripture' value={scripture} onChangeText={setScripture} placeholder='Bible reading / passage'/>
    <InputField label='Memory verse' value={memoryVerse} onChangeText={setMemoryVerse} placeholder='Optional verse'/>
    <Text style={[styles.label,{color:colors.text}]}>Devotional message</Text><TextInput value={body} onChangeText={setBody} multiline placeholder='Write the daily devotional…' placeholderTextColor={colors.textMuted} style={[styles.longInput,{color:colors.text,borderColor:colors.borderSubtle}]}/>
    <Text style={[styles.label,{color:colors.text}]}>Prayer / reflection</Text><TextInput value={prayer} onChangeText={setPrayer} multiline placeholder='Prayer or reflection prompt…' placeholderTextColor={colors.textMuted} style={[styles.longInput,styles.prayerInput,{color:colors.text,borderColor:colors.borderSubtle}]}/>
    <Button label={busy?'Saving…':'Save daily entry'} disabled={busy} onPress={()=>void saveEntry()}/>
   </View>:null}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 screen:{flex:1},content:{flexGrow:1,paddingHorizontal:spacing.md,gap:spacing.lg,maxWidth:900,width:'100%',alignSelf:'center'},form:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},title:{fontSize:18,fontWeight:'900'},copy:{fontSize:11.5,lineHeight:17,marginTop:3},
 bookPicker:{gap:8},label:{fontSize:11,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},feedback:{fontSize:11,fontWeight:'800'},section:{gap:spacing.sm},sectionTitle:{fontSize:17,fontWeight:'900'},
 seriesCard:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},seriesHead:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},flex:{flex:1,minWidth:0},seriesTitle:{fontSize:13,fontWeight:'900'},seriesMeta:{fontSize:10.5,marginTop:3},attached:{fontSize:9.5,marginTop:3},yearBadge:{borderRadius:12,paddingHorizontal:9,paddingVertical:6},yearText:{fontSize:10,fontWeight:'900'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:6},action:{minHeight:34,borderWidth:1,borderRadius:17,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:5},actionText:{fontSize:9.5,fontWeight:'800'},
 entryForm:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},entryHead:{flexDirection:'row',alignItems:'flex-start'},close:{width:36,height:36,alignItems:'center',justifyContent:'center'},longInput:{minHeight:160,borderWidth:1,borderRadius:radius.lg,padding:12,textAlignVertical:'top',fontSize:14,lineHeight:21},prayerInput:{minHeight:100},
});
