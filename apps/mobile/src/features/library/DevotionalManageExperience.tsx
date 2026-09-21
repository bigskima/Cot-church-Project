import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, Icon, InputField, ScreenHeader, Skeleton } from '@/components';
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { DevotionalSeries, LibraryBook } from './library-types';

type ManagePayload={series:DevotionalSeries[];books:Array<Pick<LibraryBook,'id'|'title'|'author_name'|'source_format'|'status'>>};
type UploadIntent={signedUploadUrl:string;storagePath:string;sourceFormat:'epub'|'pdf'};
function today(){return formatDateOnly(new Date());}
function fromIso(value:string){const [year,month,day]=value.split('-').map(Number);return new Date(year,Math.max(0,month-1),day,12,0,0,0);}

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
 const [epubFile,setEpubFile]=useState<UploadFile|null>(null);
 const [rightsConfirmed,setRightsConfirmed]=useState(false);
 const availableEpubBooks=useMemo(()=> (resource.data?.books??[]).filter((book)=>book.source_format==='epub'&&!['archived','failed','processing'].includes(book.status)),[resource.data?.books]);

 const chooseEpub=async()=>{
  setError('');setSuccess('');
  const result=await DocumentPicker.getDocumentAsync({type:['application/epub+zip','application/octet-stream'],copyToCacheDirectory:true});
  const asset=result.canceled?null:result.assets?.[0];
  if(!asset)return;
  if(!asset.name.toLowerCase().endsWith('.epub')){setError('Choose an EPUB file (.epub).');return;}
  if((asset.size??0)>75*1024*1024){setError('Choose an EPUB that is 75 MB or smaller.');return;}
  setEpubFile({uri:asset.uri,name:asset.name,mimeType:'application/epub+zip',size:asset.size,file:(asset as any).file});
  setBookId('');
 };

 const uploadEpubSource=async(sourceTitle:string,sourceAuthor:string)=>{
  if(!epubFile)throw new Error('Choose an EPUB devotional file first.');
  if(!rightsConfirmed)throw new Error('Confirm that the church has permission to use and distribute this devotional.');
  const fileBody=await readUploadFile(epubFile);
  const intent=await api.request<UploadIntent>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'create_book_upload',mimeType:'application/epub+zip',sizeBytes:fileBody.size,fileName:epubFile.name})});
  await putSignedUpload(intent.signedUploadUrl,{...epubFile,file:fileBody});
  return api.request<LibraryBook>(endpoint,{method:'POST',context:'public',body:JSON.stringify({
    action:'create_book',
    title:sourceTitle.trim()||epubFile.name.replace(/\.epub$/i,'').replace(/[-_]+/g,' '),
    subtitle:'Daily devotional source',
    authorName:sourceAuthor.trim()||'COT Ministry',
    publisher:'',
    description:'Source EPUB attached to the COT Daily Devotional.',
    sourcePath:intent.storagePath,
    sourceFormat:'epub',
    coverPath:null,
    rightsBasis:'church_owned',
    rightsNote:'Uploaded through Daily Devotional management.',
    redistributionConfirmed:true,
    status:'draft',
  })});
 };

 const createSeries=async()=>{
  if(busy)return;
  if(!title.trim()){setError('Add a devotional title.');return;}
  const numericYear=Number(year);
  if(!Number.isInteger(numericYear)||numericYear<2000||numericYear>2200){setError('Enter a valid devotional year.');return;}
  if(epubFile&&!rightsConfirmed){setError('Confirm that the church has permission to use and distribute this devotional EPUB.');return;}
  setBusy(true);setError('');setSuccess('');
  try{
   let attachedBookId=bookId||'';
   if(epubFile){
    const sourceBook=await uploadEpubSource(title,author);
    attachedBookId=sourceBook.id;
   }
   const created=await api.request<DevotionalSeries>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'create_devotional_series',title:title.trim(),authorName:author.trim(),year:numericYear,bookId:attachedBookId||undefined})});
   let mapMessage='';
   if(attachedBookId){
    try{
     const mapped=await api.request<{mapped:number;totalChapters:number}>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'import_devotional_from_book',seriesId:created.id})});
     mapMessage=` Mapped ${mapped.mapped} dated chapter${mapped.mapped===1?'':'s'} automatically.`;
    }catch(mapError){
     setError(mapError instanceof Error?mapError.message:'The EPUB is attached, but its dated chapters need manual review.');
    }
   }
   setTitle('');setAuthor('');setBookId('');setEpubFile(null);setRightsConfirmed(false);setSuccess(`Devotional series created.${mapMessage}`);resource.refresh();
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
 const attachSelectedEpub=async(series:DevotionalSeries)=>{
  if(busy)return;
  if(!epubFile){setError('Choose an EPUB in the upload section above first.');return;}
  if(!rightsConfirmed){setError('Confirm that the church has permission to use and distribute this devotional EPUB.');return;}
  setBusy(true);setError('');setSuccess('');
  try{
   const sourceBook=await uploadEpubSource(series.title,series.author_name||'');
   await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'attach_devotional_book',seriesId:series.id,bookId:sourceBook.id})});
   try{
    const result=await api.request<{mapped:number;totalChapters:number}>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'import_devotional_from_book',seriesId:series.id})});
    setSuccess(`EPUB attached. Mapped ${result.mapped} dated chapter${result.mapped===1?'':'s'} from ${result.totalChapters} chapters.`);
   }catch(mapError){
    setSuccess('EPUB attached to this devotional.');
    setError(mapError instanceof Error?mapError.message:'The EPUB is attached, but its dated chapters need manual review.');
   }
   setEpubFile(null);setRightsConfirmed(false);resource.refresh();
  }catch(value){setError(value instanceof Error?value.message:'Unable to attach this EPUB.');}
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
    <View style={styles.epubBlock}>
      <Text style={[styles.label,{color:colors.text}]}>EPUB devotional source (optional)</Text>
      <Pressable onPress={()=>void chooseEpub()} style={[styles.epubButton,{backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}>
        <Icon name='document-attach-outline' size={18} color={colors.interactive}/>
        <View style={styles.flex}><Text style={[styles.epubTitle,{color:colors.text}]}>{epubFile?.name||'Choose devotional EPUB'}</Text><Text style={[styles.epubMeta,{color:colors.textMuted}]}>Use this for a full dated devotional book · up to 75 MB</Text></View>
      </Pressable>
      <Pressable onPress={()=>setRightsConfirmed((value)=>!value)} style={styles.confirmRow}><View style={[styles.checkbox,{borderColor:rightsConfirmed?colors.interactive:colors.borderSubtle,backgroundColor:rightsConfirmed?colors.primarySoft:colors.bgSecondary}]}>{rightsConfirmed?<Icon name='checkmark' size={15} color={colors.interactive}/>:null}</View><Text style={[styles.confirmText,{color:colors.textSecondary}]}>I confirm the church has permission to use and distribute this devotional content.</Text></Pressable>
    </View>
    <View style={styles.bookPicker}><Text style={[styles.label,{color:colors.text}]}>Or attach an existing Library EPUB</Text><View style={styles.chips}><Chip label='None / manual' selected={!bookId&&!epubFile} onPress={()=>{setBookId('');setEpubFile(null);}}/>{availableEpubBooks.map((book)=><Chip key={book.id} label={book.title} selected={bookId===book.id} onPress={()=>{setBookId(book.id);setEpubFile(null);}}/>)}</View></View>
    <Button label={busy?'Creating…':'Create devotional'} disabled={busy} onPress={()=>void createSeries()}/>
   </View>

   {error?<Text style={[styles.feedback,{color:colors.live}]}>{error}</Text>:null}{success?<Text style={[styles.feedback,{color:colors.interactive}]}>{success}</Text>:null}

   <View style={styles.section}><Text style={[styles.sectionTitle,{color:colors.text}]}>Devotional series</Text>
    {resource.loading&&!resource.data?<Skeleton height={180} borderRadius={18}/>:!resource.data?.series.length?<EmptyState title='No devotional series yet' message='Create the first yearly or monthly devotional above.' iconName='sunny-outline'/>:(resource.data?.series??[]).map((series)=>{
      const attached=resource.data?.books.find((book)=>book.id===series.book_id);
      return <View key={series.id} style={[styles.seriesCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}>
       <View style={styles.seriesHead}><View style={styles.flex}><Text style={[styles.seriesTitle,{color:colors.text}]}>{series.title}</Text><Text style={[styles.seriesMeta,{color:colors.textSecondary}]}>{series.devotional_year}{series.author_name?` · ${series.author_name}`:''} · {series.status}</Text>{attached?<Text style={[styles.attached,{color:colors.textMuted}]}>Book: {attached.title}</Text>:null}</View><View style={[styles.yearBadge,{backgroundColor:colors.bgSecondary}]}><Text style={[styles.yearText,{color:colors.text}]}>{series.devotional_year}</Text></View></View>
       <View style={styles.actions}>{series.book_id?<Pressable disabled={busy} onPress={()=>void importBook(series)} style={[styles.action,{borderColor:colors.borderSubtle}]}><Icon name='sparkles-outline' size={14} color={colors.interactive}/><Text style={[styles.actionText,{color:colors.textSecondary}]}>Map dated chapters</Text></Pressable>:<Pressable disabled={busy} onPress={()=>void attachSelectedEpub(series)} style={[styles.action,{borderColor:colors.borderSubtle}]}><Icon name='document-attach-outline' size={14} color={colors.interactive}/><Text style={[styles.actionText,{color:colors.textSecondary}]}>Attach selected EPUB</Text></Pressable>}<Pressable onPress={()=>openEntry(series)} style={[styles.action,{borderColor:colors.borderSubtle}]}><Icon name='calendar-outline' size={14} color={colors.interactive}/><Text style={[styles.actionText,{color:colors.textSecondary}]}>Add day</Text></Pressable>{series.status==='draft'&&canPublish?<Pressable disabled={busy} onPress={()=>void publish(series)} style={[styles.action,{borderColor:colors.interactive,backgroundColor:colors.primarySoft}]}><Text style={[styles.actionText,{color:colors.interactive}]}>Publish</Text></Pressable>:null}</View>
      </View>;
    })}
   </View>

   {editingSeries?<View style={[styles.entryForm,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}>
    <View style={styles.entryHead}><View style={styles.flex}><Text style={[styles.title,{color:colors.text}]}>Daily entry</Text><Text style={[styles.copy,{color:colors.textSecondary}]}>{editingSeries.title} · {editingSeries.devotional_year}</Text></View><Pressable onPress={()=>setEditingSeries(null)} style={styles.close}><Icon name='close' size={18} color={colors.text}/></Pressable></View>
    <DateTimeField label='Devotional date' value={fromIso(entryDate)} onChange={(next)=>setEntryDate(formatDateOnly(next))} includeTime={false} minYear={editingSeries.devotional_year} maxYear={editingSeries.devotional_year} placeholder='Choose devotional date' helperText={`Choose a day inside ${editingSeries.devotional_year}.`}/>
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
 epubBlock:{gap:8},epubButton:{minHeight:64,borderWidth:1,borderRadius:radius.lg,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:9},epubTitle:{fontSize:11,fontWeight:'900'},epubMeta:{fontSize:9.5,lineHeight:14,marginTop:2},confirmRow:{flexDirection:'row',alignItems:'flex-start',gap:9},checkbox:{width:22,height:22,borderRadius:7,borderWidth:1,alignItems:'center',justifyContent:'center'},confirmText:{flex:1,fontSize:10.5,lineHeight:15},bookPicker:{gap:8},label:{fontSize:11,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},feedback:{fontSize:11,fontWeight:'800'},section:{gap:spacing.sm},sectionTitle:{fontSize:17,fontWeight:'900'},
 seriesCard:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},seriesHead:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},flex:{flex:1,minWidth:0},seriesTitle:{fontSize:13,fontWeight:'900'},seriesMeta:{fontSize:10.5,marginTop:3},attached:{fontSize:9.5,marginTop:3},yearBadge:{borderRadius:12,paddingHorizontal:9,paddingVertical:6},yearText:{fontSize:10,fontWeight:'900'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:6},action:{minHeight:34,borderWidth:1,borderRadius:17,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:5},actionText:{fontSize:9.5,fontWeight:'800'},
 entryForm:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},entryHead:{flexDirection:'row',alignItems:'flex-start'},close:{width:36,height:36,alignItems:'center',justifyContent:'center'},longInput:{minHeight:160,borderWidth:1,borderRadius:radius.lg,padding:12,textAlignVertical:'top',fontSize:14,lineHeight:21},prayerInput:{minHeight:100},
});
