import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { putSignedUpload, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { MinistryImageGenerator } from '@/features/ministry/MinistryImageGenerator';

type Destination='none'|'route'|'external'|'event'|'announcement'|'form';
type BannerStatus='draft'|'published'|'hidden'|'archived';
type Banner={id:string;title:string;subtitle?:string|null;image_url?:string|null;destination_type:Destination;destination_value?:string|null;status:BannerStatus;priority:number;starts_at?:string|null;ends_at?:string|null};
type FormOption={id:string;slug:string;title:string;status:string;banner_image_url?:string|null};
type EventOption={id:string;title:string;status:string;starts_at?:string|null;ends_at?:string|null;banner_url?:string|null};
type AnnouncementOption={id:string;title:string;status:string;scheduled_for?:string|null;published_at?:string|null;banner_url?:string|null};
type ManagePayload={banners:Banner[];forms:FormOption[];events:EventOption[];announcements:AnnouncementOption[]};
type UploadIntent={signedUploadUrl:string;publicUrl:string};

function safeDate(value?:string|null){if(!value)return null;const date=new Date(value);return Number.isFinite(date.getTime())?date:null;}

export default function GeneralHomeBannersManageExperience(){
 const insets=useSafeAreaInsets();
 const {api,context,hasOrganizationCapability}=useSession();
 const {colors}=useTheme();
 const organizationId=context?.organization?.id??context?.organizations?.[0]?.id??'';
 const canManage=hasOrganizationCapability('announcements.manage')||hasOrganizationCapability('events.create')||hasOrganizationCapability('events.update');
 const resource=useResource<ManagePayload>('engagement:manage:'+organizationId,(signal)=>canManage&&organizationId?api.request('noop?service=engagement-hub&action=manage&organizationId='+encodeURIComponent(organizationId),{signal,context:'public'}):Promise.resolve({banners:[],forms:[],events:[],announcements:[]}));

 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<Banner|null>(null);
 const [title,setTitle]=useState('');
 const [subtitle,setSubtitle]=useState('');
 const [destinationType,setDestinationType]=useState<Destination>('none');
 const [destinationValue,setDestinationValue]=useState('');
 const [status,setStatus]=useState<BannerStatus>('draft');
 const [priority,setPriority]=useState('0');
 const [startsAt,setStartsAt]=useState<Date|null>(null);
 const [endsAt,setEndsAt]=useState<Date|null>(null);
 const [imageFile,setImageFile]=useState<UploadFile|null>(null);
 const [generatedImageUrl,setGeneratedImageUrl]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');

 const reset=()=>{setEditing(null);setTitle('');setSubtitle('');setDestinationType('none');setDestinationValue('');setStatus('draft');setPriority('0');setStartsAt(null);setEndsAt(null);setImageFile(null);setGeneratedImageUrl('');setError('');};
 const openCreate=()=>{reset();setOpen(true);};
 const openEdit=(item:Banner)=>{setEditing(item);setTitle(item.title);setSubtitle(item.subtitle??'');setDestinationType(item.destination_type);setDestinationValue(item.destination_value??'');setStatus(item.status);setPriority(String(item.priority??0));setStartsAt(safeDate(item.starts_at));setEndsAt(safeDate(item.ends_at));setImageFile(null);setGeneratedImageUrl('');setError('');setOpen(true);};

 const chooseImage=async()=>{
   setError('');
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!permission.granted){setError('Allow photo-library access to choose a banner.');return;}
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[16,7],quality:.92});
   const asset=result.canceled?null:result.assets?.[0];
   if(!asset)return;
   const mimeType=asset.mimeType?.toLowerCase()||'image/jpeg';
   if(!['image/jpeg','image/png','image/webp'].includes(mimeType)){setError('Choose a JPG, PNG or WebP image.');return;}
   setGeneratedImageUrl('');
   setImageFile({uri:asset.uri,name:asset.fileName||'cot-home-banner.jpg',mimeType,size:asset.fileSize,file:(asset as any).file});
 };

 const save=async()=>{
   if(!title.trim()||saving)return;
   if(['event','announcement','form'].includes(destinationType)&&!destinationValue){setError('Choose what this banner should open.');return;}
   if(destinationType==='route'&&destinationValue&&!destinationValue.startsWith('/')){setError('Internal routes must begin with /.');return;}
   if(destinationType==='external'&&destinationValue&&!/^https?:\/\//i.test(destinationValue)){setError('External links must start with http:// or https://.');return;}
   setSaving(true);setError('');
   try{
     let imageUrl=generatedImageUrl||editing?.image_url||null;
     if(imageFile){
       const intent=await api.request<UploadIntent>('noop?service=engagement-hub',{method:'POST',context:'public',body:JSON.stringify({action:'create_banner_upload',organizationId,mimeType:imageFile.mimeType})});
       await putSignedUpload(intent.signedUploadUrl,imageFile);
       imageUrl=intent.publicUrl;
     }
     await api.request('noop?service=engagement-hub',{method:'POST',context:'public',body:JSON.stringify({
       action:'banner_save',organizationId,id:editing?.id,title:title.trim(),subtitle:subtitle.trim(),imageUrl,
       destinationType,destinationValue:destinationValue.trim(),status,priority:Number(priority)||0,
       startsAt:startsAt?.toISOString()??null,endsAt:endsAt?.toISOString()??null,
     })});
     invalidate('home:spotlight:banners:');invalidate('engagement:manage:');
     setOpen(false);reset();resource.refresh();
   }catch(value){setError(value instanceof Error?value.message:'Unable to save banner.');}
   finally{setSaving(false);}
 };

 const remove=async(item:Banner)=>{
   if(saving)return;setSaving(true);setError('');
   try{await api.request('noop?service=engagement-hub',{method:'POST',context:'public',body:JSON.stringify({action:'banner_delete',organizationId,id:item.id})});invalidate('home:spotlight:banners:');resource.refresh();}
   catch(value){setError(value instanceof Error?value.message:'Unable to delete banner.');}
   finally{setSaving(false);}
 };

 if(!canManage)return <View style={[styles.screen,{backgroundColor:colors.bg,paddingTop:insets.top}]}><ScreenHeader title="Home banners" showBack/><EmptyState title="Banner management is unavailable" message="Your ministry role does not include this workspace." iconName="lock-closed-outline"/></View>;

 const list=resource.data?.banners??[];
 return <View style={[styles.screen,{backgroundColor:colors.bg}]}>
   <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingTop:insets.top+spacing.sm,paddingBottom:insets.bottom+spacing.xxl}]}>
     <ScreenHeader title="Home banners" kicker="MINISTRY · HOME" subtitle="Publish official COT banners into the rotating Home spotlight." showBack rightAction={<Button label="New banner" size="sm" onPress={openCreate}/>}/>
     <View style={styles.body}>
       <SectionHeader title="Spotlight banners" badge={list.length} subtitle="Banners rotate beside Daily Quote, Daily Bible and Daily Devotional."/>
       {error?<Text style={[styles.error,{color:colors.live}]}>{error}</Text>:null}
       {resource.loading&&!resource.data?<Skeleton height={150} count={3}/>:resource.error&&!resource.data?<ResourceError message={resource.error} retry={resource.refresh}/>:list.length?list.map((item)=>(
         <View key={item.id} style={[styles.card,{backgroundColor:colors.card,borderColor:colors.borderSubtle},shadows.sm]}>
           {item.image_url?<Image source={{uri:item.image_url}} style={styles.image} resizeMode="cover"/>:<View style={[styles.imagePlaceholder,{backgroundColor:colors.primarySoft}]}><Icon name="image-outline" size={24} color={colors.interactive}/></View>}
           <View style={styles.cardCopy}><View style={styles.rowBetween}><View style={styles.flex}><Text style={[styles.title,{color:colors.text}]}>{item.title}</Text><Text style={[styles.meta,{color:colors.textMuted}]}>{item.status} · priority {item.priority} · {item.destination_type}</Text></View><Icon name="megaphone-outline" size={18} color={colors.interactive}/></View>{item.subtitle?<Text style={[styles.subtitle,{color:colors.textSecondary}]} numberOfLines={2}>{item.subtitle}</Text>:null}<View style={styles.actions}><Button label="Edit" size="sm" variant="outline" onPress={()=>openEdit(item)}/><Button label="Delete" size="sm" variant="outline" onPress={()=>void remove(item)}/></View></View>
         </View>
       )):<EmptyState title="No official banners yet" message="Daily Bible content will still rotate. Add a banner for registrations, events, announcements or external destinations." iconName="images-outline" actionLabel="Create banner" onAction={openCreate}/>}
     </View>
   </ScrollView>

   <BottomSheet visible={open} onClose={()=>!saving&&setOpen(false)} title={editing?'Edit home banner':'Create home banner'} subtitle="General COT rotating spotlight" maxHeightPercent={96}>
     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
       <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Register for Transformation Conference"/>
       <InputField label="Subtitle" value={subtitle} onChangeText={setSubtitle} multiline numberOfLines={3} placeholder="Short supporting message"/>
       <Text style={[styles.label,{color:colors.textSecondary}]}>BANNER IMAGE</Text>
       <Pressable onPress={()=>void chooseImage()} style={[styles.upload,{backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}>
         {imageFile?.uri||generatedImageUrl||editing?.image_url?<Image source={{uri:imageFile?.uri||generatedImageUrl||editing?.image_url!}} style={styles.preview} resizeMode="cover"/>:<View style={[styles.uploadIcon,{backgroundColor:colors.primarySoft}]}><Icon name="image-outline" size={23} color={colors.interactive}/></View>}
         <View style={styles.flex}><Text style={[styles.uploadTitle,{color:colors.text}]}>Choose image</Text><Text style={[styles.uploadHelp,{color:colors.textMuted}]}>Wide 16:7 artwork works best.</Text></View><Icon name="chevron-forward" size={17} color={colors.textMuted}/>
       </Pressable>
       <MinistryImageGenerator
         organizationId={organizationId}
         useCase="home_banner"
         title={title}
         description={subtitle}
         currentImageUrl={imageFile?.uri||generatedImageUrl||editing?.image_url}
         onGenerated={(url)=>{setImageFile(null);setGeneratedImageUrl(url);}}
       />
       <Text style={[styles.label,{color:colors.textSecondary}]}>ACTION</Text>
       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{(['none','route','external','event','announcement','form'] as const).map(type=><Chip key={type} label={type} selected={destinationType===type} onPress={()=>{setDestinationType(type);setDestinationValue('');}}/>)}</ScrollView>
       {destinationType==='route'?<InputField label="Internal route" value={destinationValue} onChangeText={setDestinationValue} placeholder="/general/event/..."/>:null}
       {destinationType==='external'?<InputField label="External URL" value={destinationValue} onChangeText={setDestinationValue} placeholder="https://..."/>:null}
       {destinationType==='event'?<DestinationChoices
         title="Choose event"
         empty="No events are available yet. Create the event first, then return here."
         value={destinationValue}
         items={(resource.data?.events??[]).map(item=>({value:item.id,title:item.title,meta:item.status+(item.starts_at?' · '+new Date(item.starts_at).toLocaleDateString():'')}))}
         onChange={setDestinationValue}
       />:null}
       {destinationType==='announcement'?<DestinationChoices
         title="Choose announcement"
         empty="No announcements are available yet. Publish or schedule an announcement first."
         value={destinationValue}
         items={(resource.data?.announcements??[]).map(item=>({value:item.id,title:item.title,meta:item.status+(item.published_at?' · '+new Date(item.published_at).toLocaleDateString():item.scheduled_for?' · scheduled '+new Date(item.scheduled_for).toLocaleDateString():'')}))}
         onChange={setDestinationValue}
       />:null}
       {destinationType==='form'?<DestinationChoices
         title="Choose form"
         empty="No forms are available yet. Create the form first."
         value={destinationValue}
         items={(resource.data?.forms??[]).map(item=>({value:item.slug,title:item.title,meta:item.status+' · /'+item.slug}))}
         onChange={setDestinationValue}
       />:null}
       <Text style={[styles.label,{color:colors.textSecondary}]}>STATUS</Text>
       <View style={styles.chips}>{(['draft','published','hidden','archived'] as const).map(item=><Chip key={item} label={item} selected={status===item} onPress={()=>setStatus(item)}/>)}</View>
       <InputField label="Priority" value={priority} onChangeText={setPriority} keyboardType="number-pad" placeholder="0"/>
       <DateTimeField label="Starts (optional)" value={startsAt} onChange={setStartsAt} helperText="Leave empty to start immediately."/>
       <DateTimeField label="Ends (optional)" value={endsAt} onChange={setEndsAt} helperText="Leave empty to keep running."/>
       {error?<Text style={[styles.error,{color:colors.live}]}>{error}</Text>:null}
       <Button label={editing?'Save banner':'Create banner'} loading={saving} onPress={()=>void save()} size="lg" fullWidth/>
     </ScrollView>
   </BottomSheet>
 </View>;
}

function DestinationChoices({title,empty,value,items,onChange}:{title:string;empty:string;value:string;items:Array<{value:string;title:string;meta:string}>;onChange:(value:string)=>void}){
 const {colors}=useTheme();
 return <View style={styles.destinationWrap}>
   <Text style={[styles.label,{color:colors.textSecondary}]}>{title.toUpperCase()}</Text>
   {items.length?<View style={styles.destinationList}>{items.map(item=>{
     const selected=value===item.value;
     return <Pressable key={item.value} onPress={()=>onChange(item.value)} style={[styles.destinationCard,{backgroundColor:selected?colors.primarySoft:colors.bgSecondary,borderColor:selected?colors.interactive:colors.borderSubtle}]}>
       <View style={styles.flex}><Text style={[styles.destinationTitle,{color:colors.text}]}>{item.title}</Text><Text style={[styles.destinationMeta,{color:colors.textMuted}]}>{item.meta}</Text></View>
       <Icon name={selected?'checkmark-circle':'chevron-forward'} size={18} color={selected?colors.interactive:colors.textMuted}/>
     </Pressable>;
   })}</View>:<Text style={[styles.destinationEmpty,{color:colors.textMuted}]}>{empty}</Text>}
 </View>;
}

const styles=StyleSheet.create({screen:{flex:1},content:{width:'100%',maxWidth:940,alignSelf:'center'},body:{paddingHorizontal:spacing.md,gap:spacing.md},flex:{flex:1,minWidth:0},card:{borderWidth:1,borderRadius:radius.xl,overflow:'hidden'},image:{width:'100%',aspectRatio:16/7},imagePlaceholder:{width:'100%',height:120,alignItems:'center',justifyContent:'center'},cardCopy:{padding:spacing.md,gap:spacing.sm},rowBetween:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:spacing.sm},title:{fontSize:14,fontWeight:'900'},meta:{fontSize:9.5,marginTop:2},subtitle:{fontSize:11,lineHeight:16},actions:{flexDirection:'row',gap:7,flexWrap:'wrap'},sheet:{gap:spacing.md,paddingBottom:spacing.xl},label:{fontSize:9.5,fontWeight:'900',letterSpacing:.7},upload:{minHeight:84,borderWidth:1,borderRadius:radius.xl,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm},preview:{width:120,aspectRatio:16/7,borderRadius:radius.md},uploadIcon:{width:58,height:58,borderRadius:radius.lg,alignItems:'center',justifyContent:'center'},uploadTitle:{fontSize:12.5,fontWeight:'900'},uploadHelp:{fontSize:10,marginTop:2},chips:{flexDirection:'row',flexWrap:'wrap',gap:6,paddingRight:spacing.md},destinationWrap:{gap:7},destinationList:{gap:7},destinationCard:{minHeight:58,borderWidth:1,borderRadius:radius.lg,paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:spacing.sm},destinationTitle:{fontSize:12,fontWeight:'900'},destinationMeta:{fontSize:9.5,lineHeight:14,marginTop:2},destinationEmpty:{fontSize:10.5,lineHeight:15,paddingVertical:6},error:{fontSize:11,lineHeight:16,fontWeight:'700'}});
