import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type FormField={id:string;label:string;type:'text'|'textarea'|'email'|'phone'|'number'|'select'|'checkbox'|'date';required:boolean;placeholder?:string;help?:string;options?:string[]};
type CotForm={id:string;slug:string;title:string;description:string;fields:FormField[];submit_label:string;success_message:string;requires_auth:boolean;status:string;banner_image_url?:string|null};

export default function CotFormScreen(){
  const {slug}=useLocalSearchParams<{slug:string}>();
  const insets=useSafeAreaInsets();
  const {api,context,mode}=useSession();
  const {colors}=useTheme();
  const organizationId=context?.organization?.id??context?.organizations?.[0]?.id??process.env.EXPO_PUBLIC_ORGANIZATION_ID??'';
  const resource=useResource<CotForm>('cot:form:'+slug+':'+organizationId,(signal)=>api.request('noop?service=engagement-hub&action=form&slug='+encodeURIComponent(String(slug??''))+'&organizationId='+encodeURIComponent(organizationId),{signal,context:'public'}));
  const [values,setValues]=useState<Record<string,unknown>>({});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const form=resource.data;
  const fields=form?.fields??[];
  const setValue=(id:string,value:unknown)=>setValues(current=>({...current,[id]:value}));
  const submit=async()=>{
    if(!form||saving)return;
    if(form.requires_auth&&mode!=='authenticated'){router.push({pathname:'/(auth)/login',params:{returnTo:'/general/forms/'+form.slug}} as any);return;}
    setSaving(true);setError('');
    try{
      const result=await api.request<{successMessage?:string}>('noop?service=engagement-hub',{method:'POST',context:'public',body:JSON.stringify({action:'form_submit',organizationId,formId:form.id,values})});
      setSuccess(result.successMessage||form.success_message); setValues({});
    }catch(value){setError(value instanceof Error?value.message:'Unable to submit this form.');}
    finally{setSaving(false);}
  };

  return <View style={[styles.screen,{backgroundColor:colors.bg}]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingTop:insets.top+spacing.sm,paddingBottom:insets.bottom+spacing.xxl}]}>
      <ScreenHeader title={form?.title||'Form'} kicker="COT FORM" subtitle={form?.description||undefined} showBack/>
      {form?.banner_image_url?<Image source={{uri:form.banner_image_url}} style={styles.banner} resizeMode="cover"/>:null}
      {resource.loading&&!form?<Skeleton height={90} count={4}/>:resource.error&&!form?<ResourceError message={resource.error} retry={resource.refresh}/>:form?(
        success?<View style={[styles.success,{backgroundColor:colors.successSoft,borderColor:colors.success},shadows.sm]}><View style={[styles.successIcon,{backgroundColor:colors.card}]}><Icon name="checkmark-circle" size={28} color={colors.success}/></View><Text style={[styles.successTitle,{color:colors.text}]}>Response received</Text><Text style={[styles.successText,{color:colors.textSecondary}]}>{success}</Text><Button label="Done" onPress={()=>router.back()} variant="outline"/></View>:
        <View style={[styles.form,{backgroundColor:colors.card,borderColor:colors.borderSubtle},shadows.md]}>
          {fields.map((field)=>{
            const current=values[field.id];
            if(field.type==='checkbox') return <Pressable key={field.id} onPress={()=>setValue(field.id,!current)} style={[styles.checkboxRow,{borderColor:colors.borderSubtle}]}><View style={[styles.checkbox,{backgroundColor:current?colors.interactive:colors.bgSecondary,borderColor:current?colors.interactive:colors.border}]}>{current?<Icon name="checkmark" size={15} color="#fff"/>:null}</View><View style={styles.flex}><Text style={[styles.fieldLabel,{color:colors.text}]}>{field.label}{field.required?' *':''}</Text>{field.help?<Text style={[styles.help,{color:colors.textMuted}]}>{field.help}</Text>:null}</View></Pressable>;
            if(field.type==='select') return <View key={field.id} style={styles.field}><Text style={[styles.fieldLabel,{color:colors.text}]}>{field.label}{field.required?' *':''}</Text><View style={styles.chips}>{(field.options??[]).map(option=><Chip key={option} label={option} selected={current===option} onPress={()=>setValue(field.id,option)}/>)}</View>{field.help?<Text style={[styles.help,{color:colors.textMuted}]}>{field.help}</Text>:null}</View>;
            if(field.type==='date'){
              const date=typeof current==='string'&&current?new Date(current+'T00:00:00'):null;
              return <DateTimeField key={field.id} label={field.label+(field.required?' *':'')} includeTime={false} value={date&&Number.isFinite(date.getTime())?date:null} onChange={(next)=>setValue(field.id,formatDateOnly(next))} helperText={field.help}/>;
            }
            return <View key={field.id} style={styles.field}><Text style={[styles.fieldLabel,{color:colors.text}]}>{field.label}{field.required?' *':''}</Text><TextInput value={current===undefined||current===null?'':String(current)} onChangeText={(value)=>setValue(field.id,value)} placeholder={field.placeholder||''} placeholderTextColor={colors.textMuted} multiline={field.type==='textarea'} keyboardType={field.type==='email'?'email-address':field.type==='phone'?'phone-pad':field.type==='number'?'numeric':'default'} style={[styles.input,field.type==='textarea'&&styles.textarea,{color:colors.text,backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}/>{field.help?<Text style={[styles.help,{color:colors.textMuted}]}>{field.help}</Text>:null}</View>;
          })}
          {error?<Text style={[styles.error,{color:colors.live}]}>{error}</Text>:null}
          <Button label={form.submit_label||'Submit'} loading={saving} onPress={()=>void submit()} size="lg" fullWidth/>
        </View>
      ):null}
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({screen:{flex:1},content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:spacing.md,gap:spacing.md},banner:{width:'100%',aspectRatio:16/7,borderRadius:radius.xl},form:{borderWidth:1,borderRadius:radius.xxl,padding:spacing.lg,gap:spacing.lg},field:{gap:6},fieldLabel:{fontSize:12.5,fontWeight:'900'},input:{minHeight:48,borderWidth:1,borderRadius:radius.lg,paddingHorizontal:12,fontSize:13},textarea:{minHeight:110,paddingTop:12,textAlignVertical:'top'},help:{fontSize:9.5,lineHeight:14},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},checkboxRow:{minHeight:58,borderWidth:1,borderRadius:radius.lg,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm},checkbox:{width:26,height:26,borderRadius:8,borderWidth:1,alignItems:'center',justifyContent:'center'},flex:{flex:1,minWidth:0},error:{fontSize:11,fontWeight:'700'},success:{borderWidth:1,borderRadius:radius.xxl,padding:spacing.xl,gap:spacing.md,alignItems:'center'},successIcon:{width:58,height:58,borderRadius:20,alignItems:'center',justifyContent:'center'},successTitle:{fontSize:21,fontWeight:'900'},successText:{fontSize:12,lineHeight:18,textAlign:'center'}});
