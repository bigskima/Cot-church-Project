import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, Icon, InputField, ScreenHeader, Skeleton } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { putSignedUpload, readUploadFile, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { LibraryBook } from './library-types';

type UploadIntent = { signedUploadUrl: string; storagePath: string; sourceFormat: 'epub' | 'pdf' };
type CoverIntent = { signedUploadUrl: string; storagePath: string; publicUrl: string };
const RIGHTS = [
  ['author_owned','Author / rights-holder'],
  ['church_owned','Church-owned'],
  ['licensed','Licensed for distribution'],
  ['public_domain','Public domain'],
  ['other','Other permission'],
] as const;

function bookMime(name: string, supplied?: string | null) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.epub')) return 'application/epub+zip';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return supplied === 'application/epub+zip' || supplied === 'application/pdf' ? supplied : '';
}

export function LibraryManageExperience() {
  const insets=useSafeAreaInsets();
  const {api,context,hasOrganizationCapability}=useSession();
  const {colors}=useTheme();
  const organizationId=context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canPublish=hasOrganizationCapability('sermons.publish');
  const endpoint=`noop?service=library${organizationId ? `&organizationId=${organizationId}` : ''}`;
  const books=useResource<LibraryBook[]>(`library:manage:${organizationId || 'none'}`,(signal)=>api.request<LibraryBook[]>(`noop?service=library&view=manage${organizationId ? `&organizationId=${organizationId}` : ''}`,{signal,context:'public'}));

  const [title,setTitle]=useState('');
  const [subtitle,setSubtitle]=useState('');
  const [author,setAuthor]=useState('');
  const [publisher,setPublisher]=useState('');
  const [description,setDescription]=useState('');
  const [bookFile,setBookFile]=useState<UploadFile|null>(null);
  const [coverFile,setCoverFile]=useState<UploadFile|null>(null);
  const [rightsBasis,setRightsBasis]=useState<typeof RIGHTS[number][0]>('church_owned');
  const [rightsNote,setRightsNote]=useState('');
  const [rightsConfirmed,setRightsConfirmed]=useState(false);
  const [publishNow,setPublishNow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [confirmDeleteId,setConfirmDeleteId]=useState('');

  const published=useMemo(()=> (books.data??[]).filter((book)=>book.status==='published').length,[books.data]);

  const chooseBook=async()=>{
    setError('');
    const result=await DocumentPicker.getDocumentAsync({type:['application/epub+zip','application/pdf','application/octet-stream'],copyToCacheDirectory:true});
    const asset=result.canceled?null:result.assets?.[0];
    if(!asset)return;
    const mimeType=bookMime(asset.name,asset.mimeType);
    if(!mimeType){setError('Choose an EPUB or PDF book.');return;}
    if((asset.size??0)>75*1024*1024){setError('Choose a book that is 75 MB or smaller.');return;}
    setBookFile({uri:asset.uri,name:asset.name,mimeType,size:asset.size,file:(asset as any).file});
    if(!title.trim()) setTitle(asset.name.replace(/\.(epub|pdf)$/i,'').replace(/[-_]+/g,' '));
  };
  const chooseCover=async()=>{
    setError('');
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){setError('Allow photo-library access to choose a book cover.');return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[2,3],quality:0.9});
    const asset=result.canceled?null:result.assets?.[0];
    if(!asset)return;
    const mime=asset.mimeType?.toLowerCase()||'image/jpeg';
    if(!['image/jpeg','image/png','image/webp'].includes(mime)){setError('Choose a JPG, PNG or WebP cover.');return;}
    if((asset.fileSize??0)>10*1024*1024){setError('Choose a cover smaller than 10 MB.');return;}
    setCoverFile({uri:asset.uri,name:asset.fileName||`book-cover-${Date.now()}.jpg`,mimeType:mime,size:asset.fileSize,file:(asset as any).file});
  };
  const reset=()=>{setTitle('');setSubtitle('');setAuthor('');setPublisher('');setDescription('');setBookFile(null);setCoverFile(null);setRightsBasis('church_owned');setRightsNote('');setRightsConfirmed(false);setPublishNow(false);};

  const save=async()=>{
    if(busy)return;
    if(!title.trim()||!author.trim()||!bookFile){setError('Add the title, author and EPUB/PDF file.');return;}
    if(publishNow&&!rightsConfirmed){setError('Confirm that the church is allowed to distribute this book before publishing.');return;}
    setBusy(true);setError('');setSuccess('');
    try{
      const body=await readUploadFile(bookFile);
      if(body.size>75*1024*1024)throw new Error('Choose a book that is 75 MB or smaller.');
      const intent=await api.request<UploadIntent>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'create_book_upload',mimeType:bookFile.mimeType,sizeBytes:body.size,fileName:bookFile.name})});
      await putSignedUpload(intent.signedUploadUrl,{...bookFile,file:body});
      let coverPath:string|null=null;
      if(coverFile){
        const coverIntent=await api.request<CoverIntent>(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'create_cover_upload',mimeType:coverFile.mimeType})});
        await putSignedUpload(coverIntent.signedUploadUrl,coverFile);
        coverPath=coverIntent.storagePath;
      }
      await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({
        action:'create_book',title:title.trim(),subtitle:subtitle.trim(),authorName:author.trim(),publisher:publisher.trim(),description:description.trim(),
        sourcePath:intent.storagePath,sourceFormat:intent.sourceFormat,coverPath,rightsBasis,rightsNote:rightsNote.trim(),redistributionConfirmed:rightsConfirmed,
        status:publishNow&&canPublish?'published':'draft',
      })});
      setSuccess(publishNow&&canPublish?'Book published to the Library.':'Book saved as a Library draft.');
      reset();books.refresh();
    }catch(value){setError(value instanceof Error?value.message:'Unable to save this book.');}
    finally{setBusy(false);}
  };
  const publish=async(bookId:string)=>{
    setBusy(true);setError('');
    try{await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({action:'publish_book',bookId})});setSuccess('Book published.');books.refresh();}
    catch(value){setError(value instanceof Error?value.message:'Unable to publish this book.');}
    finally{setBusy(false);}
  };
  const changeBook=async(action:'archive_book'|'restore_book'|'delete_book',bookId:string)=>{
    if(busy)return;
    setBusy(true);setError('');setSuccess('');
    try{
      await api.request(endpoint,{method:'POST',context:'public',body:JSON.stringify({action,bookId})});
      setConfirmDeleteId('');
      setSuccess(action==='archive_book'?'Book disabled and removed from the reader Library.':action==='restore_book'?'Book restored as a draft.':'Book deleted.');
      books.refresh();
    }catch(value){setError(value instanceof Error?value.message:'Unable to update this book.');}
    finally{setBusy(false);}
  };

  return <View style={[styles.screen,{backgroundColor:colors.bg}]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingTop:insets.top+spacing.sm,paddingBottom:insets.bottom+110}]}>
      <ScreenHeader title='Library management' showBack compact />
      <View style={styles.metrics}><View style={[styles.metric,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}><Text style={[styles.metricValue,{color:colors.text}]}>{books.data?.length??0}</Text><Text style={[styles.metricLabel,{color:colors.textMuted}]}>BOOKS</Text></View><View style={[styles.metric,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}><Text style={[styles.metricValue,{color:colors.text}]}>{published}</Text><Text style={[styles.metricLabel,{color:colors.textMuted}]}>PUBLISHED</Text></View></View>

      <View style={[styles.form,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}>
        <View><Text style={[styles.formTitle,{color:colors.text}]}>Add a book</Text><Text style={[styles.formCopy,{color:colors.textSecondary}]}>EPUB gives COT chapters, page-like reading and read aloud. PDF keeps the original document layout.</Text></View>
        <InputField label='Book title' value={title} onChangeText={setTitle} placeholder='Title' />
        <InputField label='Subtitle (optional)' value={subtitle} onChangeText={setSubtitle} placeholder='Subtitle' />
        <InputField label='Author' value={author} onChangeText={setAuthor} placeholder='Author name' />
        <InputField label='Publisher (optional)' value={publisher} onChangeText={setPublisher} placeholder='Publisher' />
        <InputField label='Description' value={description} onChangeText={setDescription} placeholder='What is this book about?' multiline />
        <View style={styles.fileRow}>
          <Pressable onPress={chooseBook} style={[styles.fileButton,{borderColor:colors.borderSubtle,backgroundColor:colors.bgSecondary}]}><Icon name='document-attach-outline' size={18} color={colors.interactive}/><View style={styles.flex}><Text style={[styles.fileTitle,{color:colors.text}]}>{bookFile?.name||'Choose EPUB / PDF'}</Text><Text style={[styles.fileMeta,{color:colors.textMuted}]}>Up to 75 MB</Text></View></Pressable>
          <Pressable onPress={chooseCover} style={[styles.coverButton,{borderColor:colors.borderSubtle,backgroundColor:colors.bgSecondary}]}>{coverFile?<Image source={{uri:coverFile.uri}} style={styles.coverPreview}/>:<><Icon name='image-outline' size={19} color={colors.interactive}/><Text style={[styles.coverText,{color:colors.textSecondary}]}>Cover</Text></>}</Pressable>
        </View>
        <View style={styles.rightsBlock}><Text style={[styles.label,{color:colors.text}]}>Distribution rights</Text><View style={styles.chips}>{RIGHTS.map(([key,label])=><Chip key={key} label={label} selected={rightsBasis===key} onPress={()=>setRightsBasis(key)}/>)}</View><InputField label='Rights note (optional)' value={rightsNote} onChangeText={setRightsNote} placeholder='Licence, permission, copyright holder…' /></View>
        <Pressable onPress={()=>setRightsConfirmed((value)=>!value)} style={styles.confirmRow}><View style={[styles.checkbox,{borderColor:rightsConfirmed?colors.interactive:colors.borderSubtle,backgroundColor:rightsConfirmed?colors.primarySoft:colors.bgSecondary}]}>{rightsConfirmed?<Icon name='checkmark' size={15} color={colors.interactive}/>:null}</View><Text style={[styles.confirmText,{color:colors.textSecondary}]}>I confirm COT/church has permission to distribute this book to readers.</Text></Pressable>
        {canPublish?<Pressable onPress={()=>setPublishNow((value)=>!value)} style={styles.confirmRow}><View style={[styles.checkbox,{borderColor:publishNow?colors.interactive:colors.borderSubtle,backgroundColor:publishNow?colors.primarySoft:colors.bgSecondary}]}>{publishNow?<Icon name='checkmark' size={15} color={colors.interactive}/>:null}</View><Text style={[styles.confirmText,{color:colors.textSecondary}]}>Publish immediately after processing</Text></Pressable>:null}
        {error?<Text style={[styles.feedback,{color:colors.live}]}>{error}</Text>:null}{success?<Text style={[styles.feedback,{color:colors.interactive}]}>{success}</Text>:null}
        <Button label={busy?'Saving…':'Save book'} disabled={busy} onPress={()=>void save()} />
      </View>

      <View style={styles.listSection}><Text style={[styles.listTitle,{color:colors.text}]}>Library catalogue</Text>
        {books.loading&&!books.data?<Skeleton height={180} borderRadius={18}/>:!books.data?.length?<EmptyState title='No books yet' message='Add the first EPUB or PDF above.' iconName='library-outline'/>:(books.data??[]).map((book)=>{
          const canDisable=book.status!=='archived'&&book.status!=='processing'&&(book.status!=='published'||canPublish);
          const canDelete=book.status!=='published'&&book.status!=='processing';
          return <View key={book.id} style={[styles.bookRow,{borderBottomColor:colors.borderSubtle}]}>
            <View style={styles.flex}><Text style={[styles.bookTitle,{color:colors.text}]}>{book.title}</Text><Text style={[styles.bookMeta,{color:colors.textSecondary}]}>{book.author_name} · {book.source_format.toUpperCase()} · {book.status}</Text></View>
            <View style={styles.bookActions}>
              {book.status==='draft'&&canPublish?<Pressable disabled={busy} onPress={()=>void publish(book.id)} style={[styles.publishButton,{backgroundColor:colors.primarySoft}]}><Text style={[styles.publishText,{color:colors.interactive}]}>Publish</Text></Pressable>:null}
              {book.status==='archived'?<Pressable disabled={busy} onPress={()=>void changeBook('restore_book',book.id)} style={[styles.secondaryButton,{borderColor:colors.borderSubtle}]}><Text style={[styles.secondaryText,{color:colors.textSecondary}]}>Restore</Text></Pressable>:canDisable?<Pressable disabled={busy} onPress={()=>void changeBook('archive_book',book.id)} style={[styles.secondaryButton,{borderColor:colors.borderSubtle}]}><Text style={[styles.secondaryText,{color:colors.textSecondary}]}>Disable</Text></Pressable>:null}
              {canDelete?(confirmDeleteId===book.id?<View style={styles.confirmDelete}><Pressable disabled={busy} onPress={()=>void changeBook('delete_book',book.id)} style={[styles.deleteButton,{borderColor:colors.live}]}><Text style={[styles.deleteText,{color:colors.live}]}>Confirm delete</Text></Pressable><Pressable onPress={()=>setConfirmDeleteId('')} style={styles.cancelDelete}><Text style={[styles.secondaryText,{color:colors.textMuted}]}>Cancel</Text></Pressable></View>:<Pressable disabled={busy} onPress={()=>setConfirmDeleteId(book.id)} style={[styles.deleteButton,{borderColor:colors.borderSubtle}]}><Text style={[styles.deleteText,{color:colors.live}]}>Delete</Text></Pressable>):null}
            </View>
          </View>;
        })}
      </View>
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
 screen:{flex:1},content:{flexGrow:1,paddingHorizontal:spacing.md,gap:spacing.lg,maxWidth:900,width:'100%',alignSelf:'center'},
 metrics:{flexDirection:'row',gap:spacing.sm},metric:{flex:1,borderWidth:1,borderRadius:radius.lg,padding:spacing.md},metricValue:{fontSize:22,fontWeight:'900'},metricLabel:{fontSize:8.5,fontWeight:'900',letterSpacing:1},
 form:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},formTitle:{fontSize:18,fontWeight:'900'},formCopy:{fontSize:11.5,lineHeight:17,marginTop:3},
 fileRow:{flexDirection:'row',gap:spacing.sm},fileButton:{flex:1,minHeight:64,borderWidth:1,borderRadius:radius.lg,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:9},coverButton:{width:70,minHeight:64,borderWidth:1,borderRadius:radius.lg,alignItems:'center',justifyContent:'center',gap:3,overflow:'hidden'},coverPreview:{width:'100%',height:'100%'},coverText:{fontSize:9,fontWeight:'800'},
 flex:{flex:1,minWidth:0},fileTitle:{fontSize:11,fontWeight:'900'},fileMeta:{fontSize:9,marginTop:2},rightsBlock:{gap:8},label:{fontSize:11,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},
 confirmRow:{flexDirection:'row',alignItems:'flex-start',gap:9},checkbox:{width:22,height:22,borderRadius:7,borderWidth:1,alignItems:'center',justifyContent:'center'},confirmText:{flex:1,fontSize:11,lineHeight:16},
 feedback:{fontSize:11,fontWeight:'700'},listSection:{gap:spacing.sm},listTitle:{fontSize:17,fontWeight:'900'},bookRow:{minHeight:62,borderBottomWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:spacing.sm},bookTitle:{fontSize:12.5,fontWeight:'900'},bookMeta:{fontSize:10,marginTop:3},publishButton:{height:34,borderRadius:17,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},publishText:{fontSize:9.5,fontWeight:'900'},
});
