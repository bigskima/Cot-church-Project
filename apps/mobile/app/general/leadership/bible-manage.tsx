import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, Icon, ResourceError, ScreenHeader, Skeleton } from '@/components';
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useGeneralMinistryAccess } from '@/features/general/useGeneralMinistryAccess';

type ManagePayload = {
  schedule: Array<{ id:string; scripture_date:string; reference:string; version_id:string; theme:string; source:string; message?:string|null }>;
  pool: Array<{ id:string; reference:string; theme:string; weight:number; active:boolean; organization_id?:string|null }>;
  plans: Array<{ id:string; title:string; description:string; duration_days:number; slug:string; organization_id?:string|null }>;
};
  youversion:{ready:boolean;secretName:string};
  bibleBrain:{ready:boolean;secretName:string};
  configured:Array<{provider_key:string;enabled:boolean;priority:number;configuration:Record<string,unknown>}>;
};
type Version={id:string;abbreviation?:string;title?:string;localized_title?:string};
type Tab='daily'|'pool'|'plans';

function middayDate(value:string){
  const parts=value.split('-').map(Number);
  return new Date(parts[0]||new Date().getFullYear(),Math.max(0,(parts[1]||1)-1),parts[2]||1,12,0,0,0);
}
function today(){return formatDateOnly(new Date());}

export default function BibleManageScreen(){
  const insets=useSafeAreaInsets();
  const {api,context,mode}=useSession();
  const {colors}=useTheme();
  const access=useGeneralMinistryAccess();
  const organizationId=context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const [tab,setTab]=useState<Tab>('daily');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const [date,setDate]=useState(today());
  const [reference,setReference]=useState('Philippians 4:6-7');
  const [theme,setTheme]=useState('peace');
  const [message,setMessage]=useState('');
  const [versionId,setVersionId]=useState('kjv');

  const [poolReference,setPoolReference]=useState('Psalm 46:10');
  const [poolTheme,setPoolTheme]=useState('peace');
  const [poolWeight,setPoolWeight]=useState('100');


  const [planTitle,setPlanTitle]=useState('');
  const [planDescription,setPlanDescription]=useState('');
  const [planDays,setPlanDays]=useState<Array<{title:string;references:string;reflection:string}>>([
    {title:'Day 1',references:'John 1:1-18',reflection:''},
  ]);

  const query=useMemo(()=>{
    const p=new URLSearchParams({action:'manage'});
    if(organizationId)p.set('organizationId',organizationId);
    return p.toString();
  },[organizationId]);
  const versionsQuery=useMemo(()=>{
    const p=new URLSearchParams({action:'versions',language:'en'});
    if(organizationId)p.set('organizationId',organizationId);
    return p.toString();
  },[organizationId]);

  const manage=useResource<ManagePayload>('bible:manage:'+organizationId,(signal)=>
    api.request('noop?service=bible&'+query,{signal,context:'public'})
  );
  const versions=useResource<Version[]>('bible:manage-versions:'+organizationId,(signal)=>
    api.request('noop?service=bible&'+versionsQuery,{signal,context:'public'})
  );

  const refresh=()=>{invalidate('bible:manage:');manage.refresh();};

  const save=async(body:Record<string,unknown>,key:string)=>{
    if(busy)return null;
    setBusy(key);setError('');setSuccess('');
    try{
      const result=await api.request<any>('noop?service=bible',{method:'POST',context:'public',body:JSON.stringify(body)});
      setSuccess('Saved.');
      refresh();
      return result;
    }catch(value){
      setError(value instanceof Error?value.message:'Unable to save Bible settings.');
      return null;
    }finally{setBusy('');}
  };

  const scheduleDaily=()=>save({
    action:'manage_daily',date,reference,versionId,theme,message:message.trim()||undefined,
  },'daily');

  const addPool=()=>save({
    action:'manage_pool',reference:poolReference,theme:poolTheme,weight:Number(poolWeight)||100,active:true,
  },'pool');


  const savePlan=()=>save({
    action:'manage_plan',
    title:planTitle,
    description:planDescription,
    isPublic:true,
    days:planDays.map((day,index)=>({
      title:day.title.trim()||('Day '+(index+1)),
      references:day.references.split(',').map(item=>item.trim()).filter(Boolean),
      reflection:day.reflection.trim()||undefined,
    })),
  },'plan');

  const loadPlanTemplate=async(planId:string)=>{
    if(busy)return;
    setBusy('template:'+planId);setError('');setSuccess('');
    try{
      const p=new URLSearchParams({action:'plan',planId});
      if(organizationId)p.set('organizationId',organizationId);
      const detail=await api.request<any>('noop?service=bible&'+p.toString(),{context:'public'});
      setPlanTitle(detail.title||'');
      setPlanDescription(detail.description||'');
      setPlanDays((detail.days??[]).map((day:any,index:number)=>({
        title:day.title||('Day '+(index+1)),
        references:(day.references??day.scripture_references??[]).join(', '),
        reflection:day.reflection||'',
      })));
      setSuccess('Template loaded. Edit anything before publishing.');
    }catch(value){
      setError(value instanceof Error?value.message:'Unable to load this reading-plan template.');
    }finally{setBusy('');}
  };

  if(mode!=='authenticated'){
    return <View style={[styles.state,{backgroundColor:colors.bg}]}><EmptyState title="Sign in for Bible ministry" message="Bible management follows your COT ministry role." iconName="book-outline"/><Button label="Sign in" onPress={()=>router.push({pathname:'/(auth)/login',params:{returnTo:'/general/leadership/bible-manage'}} as any)}/></View>;
  }
  if(!access.accessReady){
    return <View style={[styles.state,{backgroundColor:colors.bg}]}><Skeleton height={70}/><Skeleton height={220}/></View>;
  }
  if(!access.canManageBible){
    return <View style={[styles.state,{backgroundColor:colors.bg}]}><EmptyState title="Bible management is not assigned" message="A ministry role with Bible management access is required." iconName="lock-closed-outline"/><Button label="Back to Ministry Tools" variant="outline" onPress={()=>router.replace('/general/leadership')}/></View>;
  }


  return <View style={[styles.screen,{backgroundColor:colors.bg}]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingTop:insets.top+spacing.sm,paddingBottom:insets.bottom+120}]}>
      <ScreenHeader title="Bible & Daily Scripture" subtitle="Manage Daily Scripture, the curated verse pool and reading plans. Platform Bible providers and translations are controlled in Platform Administration." showBack compact/>
      <View style={styles.tabs}>
        <Chip label="Daily Scripture" selected={tab==='daily'} onPress={()=>setTab('daily')}/>
        <Chip label="Verse pool" selected={tab==='pool'} onPress={()=>setTab('pool')}/>
        <Chip label="Reading plans" selected={tab==='plans'} onPress={()=>setTab('plans')}/>
      </View>

      {manage.loading&&!manage.data?<Skeleton height={260}/>:manage.error&&!manage.data?<ResourceError message={manage.error} retry={manage.refresh}/>:null}

      {tab==='daily'?<View style={styles.section}>
        <View style={[styles.info,{backgroundColor:colors.primarySoft,borderColor:colors.borderSubtle}]}>
          <Icon name="sunny-outline" size={20} color={colors.interactive}/>
          <View style={styles.flex}><Text style={[styles.infoTitle,{color:colors.text}]}>Automatic every day, ministry-controlled when needed</Text><Text style={[styles.infoText,{color:colors.textSecondary}]}>If you do not schedule a date, COT selects from the curated Scripture pool. A scheduled entry always overrides the automatic choice.</Text></View>
        </View>
        <View style={[styles.formCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle},shadows.sm]}>
          <Text style={[styles.cardTitle,{color:colors.text}]}>Schedule or override a day</Text>
          <DateTimeField label="Scripture date" value={middayDate(date)} onChange={next=>setDate(formatDateOnly(next))} includeTime={false} minYear={2020} maxYear={2200}/>
          <LabeledInput label="Bible reference" value={reference} onChangeText={setReference} placeholder="Philippians 4:6-7"/>
          <View><Text style={[styles.label,{color:colors.textMuted}]}>Translation</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{(versions.data??[]).slice(0,25).map(item=><Chip key={String(item.id)} label={item.abbreviation||item.title||String(item.id)} selected={versionId===String(item.id)} onPress={()=>setVersionId(String(item.id))}/>)}</ScrollView></View>
          <LabeledInput label="Theme" value={theme} onChangeText={setTheme} placeholder="peace"/>
          <LabeledInput label="Ministry note (optional)" value={message} onChangeText={setMessage} placeholder="A short introduction for today's Scripture" multiline/>
          <Button label="Save Daily Scripture" loading={busy==='daily'} onPress={()=>void scheduleDaily()}/>
        </View>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>Upcoming schedule</Text>
        {(manage.data?.schedule??[]).length?(manage.data?.schedule??[]).map(item=><View key={item.id} style={[styles.rowCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}><View style={styles.flex}><Text style={[styles.rowTitle,{color:colors.text}]}>{item.scripture_date} · {item.reference}</Text><Text style={[styles.rowMeta,{color:colors.textMuted}]}>{item.theme} · {item.version_id} · {item.source}</Text></View><Icon name="checkmark-circle-outline" size={18} color={colors.interactive}/></View>):<Text style={[styles.empty,{color:colors.textMuted}]}>No overrides scheduled. Automatic Scripture selection will continue.</Text>}
      </View>:null}

      {tab==='pool'?<View style={styles.section}>
        <View style={[styles.formCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle},shadows.sm]}>
          <Text style={[styles.cardTitle,{color:colors.text}]}>Add to curated pool</Text>
          <Text style={[styles.help,{color:colors.textMuted}]}>Use complete, meaningful passages rather than random verse fragments. COT rotates this pool automatically.</Text>
          <LabeledInput label="Reference" value={poolReference} onChangeText={setPoolReference} placeholder="Psalm 46:10"/>
          <LabeledInput label="Theme" value={poolTheme} onChangeText={setPoolTheme} placeholder="peace"/>
          <LabeledInput label="Weight" value={poolWeight} onChangeText={setPoolWeight} placeholder="100"/>
          <Button label="Add Scripture" loading={busy==='pool'} onPress={()=>void addPool()}/>
        </View>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>Curated Scriptures</Text>
        <View style={styles.poolWrap}>{(manage.data?.pool??[]).map(item=><View key={item.id} style={[styles.poolPill,{backgroundColor:item.organization_id?colors.primarySoft:colors.bgSecondary,borderColor:colors.borderSubtle}]}><Text style={[styles.poolRef,{color:colors.text}]}>{item.reference}</Text><Text style={[styles.poolTheme,{color:colors.textMuted}]}>{item.theme}</Text></View>)}</View>
      </View>:null}

      {tab==='plans'?<View style={styles.section}>
        <View style={[styles.formCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle},shadows.sm]}>
          <Text style={[styles.cardTitle,{color:colors.text}]}>Create or edit reading plan</Text>
          <Text style={[styles.help,{color:colors.textMuted}]}>Start from an empty plan or load any catalogue plan below as a template, then change the title, passages, days and reflections before publishing.</Text>
          <LabeledInput label="Plan title" value={planTitle} onChangeText={setPlanTitle} placeholder="21 Days of Prayer"/>
          <LabeledInput label="Description" value={planDescription} onChangeText={setPlanDescription} placeholder="What will members walk through?" multiline/>
          {planDays.map((day,index)=><View key={index} style={[styles.dayEditor,{backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}><View style={styles.rowBetween}><Text style={[styles.dayTitle,{color:colors.text}]}>Day {index+1}</Text>{planDays.length>1?<Pressable onPress={()=>setPlanDays(current=>current.filter((_,i)=>i!==index))}><Icon name="trash-outline" size={17} color={colors.live}/></Pressable>:null}</View><LabeledInput label="Title" value={day.title} onChangeText={value=>setPlanDays(current=>current.map((item,i)=>i===index?{...item,title:value}:item))} placeholder={'Day '+(index+1)}/><LabeledInput label="References (comma separated)" value={day.references} onChangeText={value=>setPlanDays(current=>current.map((item,i)=>i===index?{...item,references:value}:item))} placeholder="John 1:1-18, Psalm 1"/><LabeledInput label="Reflection" value={day.reflection} onChangeText={value=>setPlanDays(current=>current.map((item,i)=>i===index?{...item,reflection:value}:item))} placeholder="Short reflection or instruction" multiline/></View>)}
          <Button label="Add day" variant="outline" onPress={()=>setPlanDays(current=>[...current,{title:'Day '+(current.length+1),references:'',reflection:''}])}/>
          <Button label="Publish reading plan" loading={busy==='plan'} onPress={()=>void savePlan()}/>
        </View>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>Plan catalogue & templates</Text>
        <Text style={[styles.help,{color:colors.textMuted}]}>Use a built-in or COT plan as a starting point. Loading a template never changes the original.</Text>
        {(manage.data?.plans??[]).map(item=><View key={item.id} style={[styles.rowCard,{backgroundColor:colors.card,borderColor:colors.borderSubtle}]}><View style={styles.flex}><Text style={[styles.rowTitle,{color:colors.text}]}>{item.title}</Text><Text style={[styles.rowMeta,{color:colors.textMuted}]}>{item.duration_days} days · {item.organization_id?'COT ministry':'Built-in template'}</Text></View><Button label="Use template" variant="outline" size="sm" loading={busy==='template:'+item.id} onPress={()=>void loadPlanTemplate(item.id)}/></View>)}
      </View>:null}

      {error?<Text style={[styles.error,{color:colors.live}]}>{error}</Text>:null}
      {success?<Text style={[styles.success,{color:colors.interactive}]}>{success}</Text>:null}
    </ScrollView>
  </View>;
}

function LabeledInput({label,value,onChangeText,placeholder,multiline=false}:{label:string;value:string;onChangeText:(value:string)=>void;placeholder?:string;multiline?:boolean}){
  const {colors}=useTheme();
  return <View style={styles.field}><Text style={[styles.label,{color:colors.textMuted}]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={[styles.input,multiline&&styles.multiline,{color:colors.text,backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}/></View>;
}
const styles=StyleSheet.create({
  screen:{flex:1},state:{flex:1,padding:spacing.xl,justifyContent:'center',gap:spacing.md},content:{width:'100%',maxWidth:900,alignSelf:'center',paddingHorizontal:spacing.md,gap:spacing.md},tabs:{flexDirection:'row',flexWrap:'wrap',gap:7},section:{gap:spacing.md},flex:{flex:1,minWidth:0},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},
  info:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},infoTitle:{fontSize:12.5,fontWeight:'900'},infoText:{fontSize:10.5,lineHeight:16,marginTop:3},
  formCard:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.md},cardTitle:{fontSize:16,fontWeight:'900'},field:{gap:5},label:{fontSize:9.5,fontWeight:'900',letterSpacing:.5},input:{minHeight:44,borderWidth:1,borderRadius:radius.lg,paddingHorizontal:12,fontSize:12.5},multiline:{minHeight:96,paddingVertical:10,textAlignVertical:'top'},chips:{gap:6,paddingRight:spacing.md},help:{fontSize:10.5,lineHeight:16},
  sectionTitle:{fontSize:14,fontWeight:'900'},rowCard:{minHeight:64,borderWidth:1,borderRadius:radius.lg,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm},rowTitle:{fontSize:12,fontWeight:'900'},rowMeta:{fontSize:9.5,lineHeight:14,marginTop:2},empty:{fontSize:11,lineHeight:17},
  poolWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},poolPill:{borderWidth:1,borderRadius:radius.lg,paddingHorizontal:10,paddingVertical:8},poolRef:{fontSize:10.5,fontWeight:'900'},poolTheme:{fontSize:8.5,marginTop:2,textTransform:'capitalize'},
  providerCard:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm},providerIcon:{width:44,height:44,borderRadius:15,alignItems:'center',justifyContent:'center'},providerTitle:{fontSize:13,fontWeight:'900'},providerSubtitle:{fontSize:10.5,lineHeight:15,marginTop:2},readyText:{fontSize:9,fontWeight:'900'},secretBox:{borderWidth:1,borderRadius:radius.lg,padding:spacing.md,gap:4},secretLabel:{fontSize:8.5,fontWeight:'900',letterSpacing:.8},secretValue:{fontSize:11,fontWeight:'800'},
  dayEditor:{borderWidth:1,borderRadius:radius.lg,padding:spacing.sm,gap:spacing.sm},dayTitle:{fontSize:12,fontWeight:'900'},error:{fontSize:11,fontWeight:'700'},success:{fontSize:11,fontWeight:'800'}
});
