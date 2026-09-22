import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { putSignedUpload, type UploadFile } from '@/services/uploads';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { MinistryImageGenerator } from '@/features/ministry/MinistryImageGenerator';

type FieldType = 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select' | 'checkbox' | 'date';
type FormField = { id: string; label: string; type: FieldType; required: boolean; placeholder?: string; help?: string; options?: string[] };
type CotForm = {
  id: string; slug: string; title: string; description: string; status: 'draft' | 'published' | 'closed' | 'hidden';
  fields: FormField[]; submit_label: string; success_message: string; requires_auth: boolean; banner_image_url?: string | null; updated_at?: string;
};
type UploadIntent = { signedUploadUrl: string; publicUrl: string };
type ResponseRow = {
  id: string; values: Record<string, unknown>; status: 'active' | 'hidden'; created_at: string;
  profile?: { display_name?: string; username?: string } | null;
};

const TYPES: FieldType[] = ['text','textarea','email','phone','number','select','checkbox','date'];

function fieldKey(label: string, fallback: string) {
  return (label || fallback).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || fallback;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export default function GeneralFormsManageExperience() {
  const insets = useSafeAreaInsets();
  const { api, context, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const canManage = hasOrganizationCapability('announcements.manage') || hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update');
  const resource = useResource<{ forms: CotForm[]; banners: any[] }>(
    'engagement:manage:' + organizationId,
    (signal) => canManage && organizationId
      ? api.request('noop?service=engagement-hub&action=manage&organizationId=' + encodeURIComponent(organizationId), { signal, context: 'public' })
      : Promise.resolve({ forms: [], banners: [] }),
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CotForm | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CotForm['status']>('draft');
  const [submitLabel, setSubmitLabel] = useState('Submit');
  const [successMessage, setSuccessMessage] = useState('Thank you. Your response has been received.');
  const [requiresAuth, setRequiresAuth] = useState(true);
  const [bannerFile, setBannerFile] = useState<UploadFile | null>(null);
  const [generatedBannerUrl, setGeneratedBannerUrl] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [responseForm, setResponseForm] = useState<CotForm | null>(null);

  const responses = useResource<ResponseRow[]>(
    'engagement:responses:' + (responseForm?.id ?? 'none'),
    (signal) => responseForm
      ? api.request('noop?service=engagement-hub&action=submissions&formId=' + encodeURIComponent(responseForm.id) + '&organizationId=' + encodeURIComponent(organizationId), { signal, context: 'public' })
      : Promise.resolve([]),
  );

  const list = resource.data?.forms ?? [];
  const publishedCount = useMemo(() => list.filter((item) => item.status === 'published').length, [list]);

  const reset = () => {
    setEditing(null); setTitle(''); setSlug(''); setDescription(''); setStatus('draft');
    setSubmitLabel('Submit'); setSuccessMessage('Thank you. Your response has been received.'); setRequiresAuth(true); setBannerFile(null); setGeneratedBannerUrl(''); setFields([]); setError('');
  };
  const openCreate = () => { reset(); setFields([{ id: 'name', label: 'Name', type: 'text', required: true }]); setEditorOpen(true); };
  const openEdit = (item: CotForm) => {
    setEditing(item); setTitle(item.title); setSlug(item.slug); setDescription(item.description); setStatus(item.status);
    setSubmitLabel(item.submit_label); setSuccessMessage(item.success_message); setRequiresAuth(item.requires_auth); setBannerFile(null); setGeneratedBannerUrl('');
    setFields((item.fields ?? []).map((field) => ({ ...field, options: field.options ?? [] }))); setError(''); setEditorOpen(true);
  };

  const updateField = (index: number, next: Partial<FormField>) => {
    setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...next } : field));
  };
  const addField = () => setFields((current) => [...current, { id: 'field_' + (current.length + 1), label: 'New field', type: 'text', required: false }]);

  const chooseBannerImage = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Allow photo-library access to choose the form banner.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 7], quality: .92 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const mimeType = asset.mimeType?.toLowerCase() || 'image/jpeg';
    if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) { setError('Choose a JPG, PNG or WebP image.'); return; }
    setGeneratedBannerUrl('');
    setBannerFile({ uri: asset.uri, name: asset.fileName || 'cot-form-banner.jpg', mimeType, size: asset.fileSize, file: (asset as any).file });
  };

  const save = async () => {
    if (!title.trim() || !fields.length || saving) { setError('Add a form title and at least one field.'); return; }
    setSaving(true); setError('');
    try {
      const normalizedFields = fields.map((field, index) => ({
        ...field,
        id: fieldKey(field.label, 'field_' + (index + 1)),
        options: field.type === 'select' ? (field.options ?? []).filter(Boolean) : [],
      }));
      let bannerImageUrl = generatedBannerUrl || editing?.banner_image_url || null;
      if (bannerFile) {
        const intent = await api.request<UploadIntent>('noop?service=engagement-hub', {
          method: 'POST',
          context: 'public',
          body: JSON.stringify({ action: 'create_banner_upload', organizationId, mimeType: bannerFile.mimeType }),
        });
        await putSignedUpload(intent.signedUploadUrl, bannerFile);
        bannerImageUrl = intent.publicUrl;
      }
      await api.request('noop?service=engagement-hub', {
        method: 'POST', context: 'public',
        body: JSON.stringify({
          action: 'form_save', organizationId, id: editing?.id,
          title: title.trim(), slug: slug.trim() || fieldKey(title, 'form').replace(/_/g, '-'),
          description: description.trim(), status, fields: normalizedFields,
          submitLabel: submitLabel.trim() || 'Submit',
          successMessage: successMessage.trim() || 'Thank you. Your response has been received.',
          requiresAuth, bannerImageUrl,
        }),
      });
      invalidate('engagement:manage:'); invalidate('home:spotlight:banners:');
      setEditorOpen(false); reset(); resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save form.'); }
    finally { setSaving(false); }
  };

  const removeForm = async (item: CotForm) => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await api.request('noop?service=engagement-hub', { method: 'POST', context: 'public', body: JSON.stringify({ action: 'form_delete', organizationId, id: item.id }) });
      resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to delete form.'); }
    finally { setSaving(false); }
  };

  const openResponses = (item: CotForm) => { setResponseForm(item); setResponsesOpen(true); setTimeout(() => responses.refresh(), 0); };

  const responseAction = async (row: ResponseRow, action: 'submission_status' | 'submission_delete', statusValue?: 'active' | 'hidden') => {
    await api.request('noop?service=engagement-hub', {
      method: 'POST', context: 'public',
      body: JSON.stringify({ action, organizationId, id: row.id, ...(statusValue ? { status: statusValue } : {}) }),
    });
    responses.refresh();
  };

  const exportResponses = async () => {
    if (!responseForm) return;
    const rows = responses.data ?? [];
    const fieldIds = (responseForm.fields ?? []).map((field) => field.id);
    const headers = ['submitted_at','member','username',...fieldIds];
    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => [
        row.created_at,
        row.profile?.display_name ?? '',
        row.profile?.username ?? '',
        ...fieldIds.map((id) => row.values?.[id] ?? ''),
      ].map(csvEscape).join(',')),
    ].join('\n');
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = responseForm.slug + '-responses.csv';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ title: responseForm.title + ' responses', message: csv });
  };

  if (!canManage) {
    return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}><ScreenHeader title="Forms" showBack /><EmptyState title="Forms are unavailable" message="Your ministry role does not include form management." iconName="lock-closed-outline" /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Forms & responses" kicker="MINISTRY · ENGAGEMENT" subtitle="Build configurable forms, publish them inside COT and manage responses." showBack rightAction={<Button label="New form" size="sm" onPress={openCreate} />} />
        <View style={styles.body}>
          <View style={styles.summaryRow}>
            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.summaryNumber,{color:colors.text}]}>{list.length}</Text><Text style={[styles.summaryLabel,{color:colors.textMuted}]}>Forms</Text></View>
            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.summaryNumber,{color:colors.text}]}>{publishedCount}</Text><Text style={[styles.summaryLabel,{color:colors.textMuted}]}>Published</Text></View>
          </View>
          {error ? <Text style={[styles.error,{color:colors.live}]}>{error}</Text> : null}
          <SectionHeader title="Form library" badge={list.length} subtitle="Reusable forms can be linked from banners, announcements and events." />
          {resource.loading && !resource.data ? <Skeleton height={104} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : list.length ? list.map((item) => (
            <View key={item.id} style={[styles.card,{backgroundColor:colors.card,borderColor:colors.borderSubtle},shadows.sm]}>
              {item.banner_image_url ? <Image source={{ uri: item.banner_image_url }} style={styles.formBannerThumb} resizeMode="cover" /> : null}
              <View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.cardTitle,{color:colors.text}]}>{item.title}</Text><Text style={[styles.cardMeta,{color:colors.textMuted}]}>/{item.slug} · {item.fields?.length ?? 0} fields · {item.status}</Text></View><Icon name="document-text-outline" size={20} color={colors.interactive}/></View>
              {item.description ? <Text style={[styles.cardBody,{color:colors.textSecondary}]} numberOfLines={2}>{item.description}</Text> : null}
              <View style={styles.actions}><Button label="Edit" variant="outline" size="sm" onPress={()=>openEdit(item)}/><Button label="Responses" variant="outline" size="sm" onPress={()=>openResponses(item)}/><Button label="Open" variant="outline" size="sm" onPress={()=>router.push('/general/forms/'+item.slug as any)}/><Button label="Delete" variant="outline" size="sm" onPress={()=>void removeForm(item)}/></View>
            </View>
          )) : <EmptyState title="No forms yet" message="Create your first configurable form for registrations, follow-up, applications, surveys or event details." iconName="document-text-outline" actionLabel="Create form" onAction={openCreate}/>}
        </View>
      </ScrollView>

      <BottomSheet visible={editorOpen} onClose={()=>!saving&&setEditorOpen(false)} title={editing?'Edit form':'Create form'} subtitle="Schema-driven · no hardcoded questions" maxHeightPercent={96}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <InputField label="Form title" value={title} onChangeText={setTitle} placeholder="Conference registration"/>
          <InputField label="URL slug" value={slug} onChangeText={setSlug} placeholder="conference-registration"/>
          <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Explain what this form is for."/>
          <Text style={[styles.label,{color:colors.textSecondary}]}>HOME BANNER IMAGE</Text>
          <Pressable onPress={()=>void chooseBannerImage()} style={[styles.upload,{backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}>
            {bannerFile?.uri || generatedBannerUrl || editing?.banner_image_url
              ? <Image source={{ uri: bannerFile?.uri || generatedBannerUrl || editing?.banner_image_url! }} style={styles.uploadPreview} resizeMode="cover" />
              : <View style={[styles.uploadIcon,{backgroundColor:colors.primarySoft}]}><Icon name="image-outline" size={23} color={colors.interactive}/></View>}
            <View style={styles.flex}>
              <Text style={[styles.uploadTitle,{color:colors.text}]}>{bannerFile || generatedBannerUrl || editing?.banner_image_url ? 'Change banner image' : 'Choose banner image'}</Text>
              <Text style={[styles.uploadHelp,{color:colors.textMuted}]}>Published forms automatically appear in the Home spotlight. Wide 16:7 artwork is used there.</Text>
            </View>
            <Icon name="chevron-forward" size={17} color={colors.textMuted}/>
          </Pressable>
          <MinistryImageGenerator
            organizationId={organizationId}
            useCase="form_banner"
            title={title}
            description={description}
            context={{ purpose: description }}
            currentImageUrl={bannerFile?.uri || generatedBannerUrl || editing?.banner_image_url}
            onGenerated={(url)=>{setBannerFile(null);setGeneratedBannerUrl(url);}}
            onUploadInstead={() => void chooseBannerImage()}
          />
          <Text style={[styles.label,{color:colors.textSecondary}]}>STATUS</Text>
          <View style={styles.chips}>{(['draft','published','closed','hidden'] as const).map((item)=><Chip key={item} label={item} selected={status===item} onPress={()=>setStatus(item)}/>)}</View>
          <View style={styles.toggleRow}><Text style={[styles.toggleText,{color:colors.text}]}>Require signed-in member</Text><Chip label={requiresAuth?'Yes':'No'} selected={requiresAuth} onPress={()=>setRequiresAuth(v=>!v)}/></View>
          <InputField label="Submit button" value={submitLabel} onChangeText={setSubmitLabel} placeholder="Submit"/>
          <InputField label="Success message" value={successMessage} onChangeText={setSuccessMessage} multiline numberOfLines={3} placeholder="Thank you…"/>

          <View style={styles.rowBetween}><Text style={[styles.sectionTitle,{color:colors.text}]}>Fields</Text><Button label="Add field" size="sm" variant="outline" onPress={addField}/></View>
          {fields.map((field,index)=>(
            <View key={index} style={[styles.fieldCard,{backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle}]}>
              <View style={styles.rowBetween}><Text style={[styles.fieldNumber,{color:colors.textMuted}]}>FIELD {index+1}</Text><Pressable onPress={()=>setFields(current=>current.filter((_,i)=>i!==index))}><Icon name="trash-outline" size={17} color={colors.live}/></Pressable></View>
              <InputField label="Label" value={field.label} onChangeText={(value)=>updateField(index,{label:value})} placeholder="Question"/>
              <Text style={[styles.label,{color:colors.textSecondary}]}>TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{TYPES.map((type)=><Chip key={type} label={type} selected={field.type===type} onPress={()=>updateField(index,{type})}/>)}</ScrollView>
              <InputField label="Placeholder / hint" value={field.placeholder ?? ''} onChangeText={(value)=>updateField(index,{placeholder:value})} placeholder="Optional"/>
              {field.type==='select' ? <InputField label="Options (comma separated)" value={(field.options??[]).join(', ')} onChangeText={(value)=>updateField(index,{options:value.split(',').map(item=>item.trim()).filter(Boolean)})} placeholder="Option A, Option B"/> : null}
              <View style={styles.toggleRow}><Text style={[styles.toggleText,{color:colors.text}]}>Required</Text><Chip label={field.required?'Yes':'No'} selected={field.required} onPress={()=>updateField(index,{required:!field.required})}/></View>
            </View>
          ))}
          {error ? <Text style={[styles.error,{color:colors.live}]}>{error}</Text> : null}
          <Button label={editing?'Save form':'Create form'} loading={saving} onPress={()=>void save()} size="lg" fullWidth/>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={responsesOpen} onClose={()=>setResponsesOpen(false)} title={responseForm?.title || 'Responses'} subtitle={(responses.data?.length ?? 0)+' response(s)'} maxHeightPercent={94}>
        <View style={styles.sheet}>
          <View style={styles.rowBetween}><Text style={[styles.sectionTitle,{color:colors.text}]}>Collected data</Text><Button label="Export CSV" variant="outline" size="sm" onPress={()=>void exportResponses()}/></View>
          {responses.loading && !responses.data ? <Skeleton height={90} count={3}/> : responses.error && !responses.data ? <ResourceError message={responses.error} retry={responses.refresh}/> : (responses.data??[]).length ? (
            <ScrollView style={{maxHeight:560}} showsVerticalScrollIndicator={false} contentContainerStyle={styles.responseList}>
              {(responses.data??[]).map((row)=>(
                <View key={row.id} style={[styles.responseCard,{backgroundColor:colors.bgSecondary,borderColor:colors.borderSubtle,opacity:row.status==='hidden'?.56:1}]}>
                  <View style={styles.rowBetween}><View style={styles.flex}><Text style={[styles.responseName,{color:colors.text}]}>{row.profile?.display_name || 'Anonymous response'}</Text><Text style={[styles.cardMeta,{color:colors.textMuted}]}>{new Date(row.created_at).toLocaleString()} {row.profile?.username?'· @'+row.profile.username:''}</Text></View><Text style={[styles.fieldNumber,{color:colors.textMuted}]}>{row.status}</Text></View>
                  {Object.entries(row.values??{}).map(([key,value])=><View key={key} style={styles.answerRow}><Text style={[styles.answerKey,{color:colors.textMuted}]}>{key.replace(/_/g,' ')}</Text><Text style={[styles.answerValue,{color:colors.text}]}>{String(value ?? '')}</Text></View>)}
                  <View style={styles.actions}><Button label={row.status==='hidden'?'Restore':'Hide'} variant="outline" size="sm" onPress={()=>void responseAction(row,'submission_status',row.status==='hidden'?'active':'hidden')}/><Button label="Delete" variant="outline" size="sm" onPress={()=>void responseAction(row,'submission_delete')}/></View>
                </View>
              ))}
            </ScrollView>
          ) : <EmptyState title="No responses yet" message="Responses will appear here as members submit this form." iconName="file-tray-outline"/>}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1},content:{flexGrow:1,width:'100%',maxWidth:940,alignSelf:'center'},body:{paddingHorizontal:spacing.md,gap:spacing.md},flex:{flex:1,minWidth:0},
  summaryRow:{flexDirection:'row',gap:spacing.sm},summary:{flex:1,borderWidth:1,borderRadius:radius.xl,padding:spacing.md},summaryNumber:{fontSize:24,fontWeight:'900'},summaryLabel:{fontSize:10.5,marginTop:2},
  card:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.sm},formBannerThumb:{width:'100%',aspectRatio:16/7,borderRadius:radius.lg,marginBottom:2},cardTop:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},cardTitle:{fontSize:14,fontWeight:'900'},cardMeta:{fontSize:9.5,lineHeight:14,marginTop:2},cardBody:{fontSize:11,lineHeight:16},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:6},sheet:{gap:spacing.md,paddingBottom:spacing.xl},label:{fontSize:9.5,fontWeight:'900',letterSpacing:.7},chips:{flexDirection:'row',flexWrap:'wrap',gap:6,paddingRight:spacing.md},upload:{minHeight:84,borderWidth:1,borderRadius:radius.xl,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm},uploadPreview:{width:120,aspectRatio:16/7,borderRadius:radius.md},uploadIcon:{width:58,height:58,borderRadius:radius.lg,alignItems:'center',justifyContent:'center'},uploadTitle:{fontSize:12.5,fontWeight:'900'},uploadHelp:{fontSize:10,lineHeight:14,marginTop:2},
  toggleRow:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},toggleText:{fontSize:12,fontWeight:'800'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},
  sectionTitle:{fontSize:14,fontWeight:'900'},fieldCard:{borderWidth:1,borderRadius:radius.xl,padding:spacing.md,gap:spacing.sm},fieldNumber:{fontSize:8.5,fontWeight:'900',letterSpacing:.8},
  error:{fontSize:11,lineHeight:16,fontWeight:'700'},responseList:{gap:spacing.sm,paddingBottom:spacing.md},responseCard:{borderWidth:1,borderRadius:radius.lg,padding:spacing.md,gap:spacing.sm},responseName:{fontSize:12.5,fontWeight:'900'},
  answerRow:{gap:2},answerKey:{fontSize:8.5,fontWeight:'900',textTransform:'uppercase'},answerValue:{fontSize:11.5,lineHeight:16},
});
