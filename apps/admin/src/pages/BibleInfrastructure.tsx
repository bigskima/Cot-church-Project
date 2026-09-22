import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, StatWidget, Table } from '../components/ui';

type BibleProvider = {
  provider_key:string;
  display_name:string;
  provider_kind:'text'|'licensed_text'|'audio';
  enabled:boolean;
  priority:number;
  ready:boolean;
  secretName?:string|null;
};

type BibleTranslation = {
  id:string;
  abbreviation?:string;
  localized_abbreviation?:string;
  title?:string;
  localized_title?:string;
  language_tag?:string;
  copyright?:string|null;
  provider:'getbible'|'youversion';
  available:boolean;
  accessStatus?:string;
  enabled:boolean;
  isDefault:boolean;
  priority:number;
  providerEnabled:boolean;
  runtimeEnabled:boolean;
};

type BiblePayload = {
  providers:BibleProvider[];
  translations:BibleTranslation[];
  defaultVersionId:string;
};

type FeatureItem = {
  key:string;
  name:string;
  global_enabled:boolean;
  rollout_percentage:number;
  configuration?:Record<string,unknown>;
};

type FeaturePayload = { items:FeatureItem[] };

function providerLabel(value:string){
  if(value==='getbible') return 'Public domain';
  if(value==='youversion') return 'YouVersion';
  if(value==='bible_brain') return 'Bible Brain';
  return value;
}

export function BibleInfrastructure({
  api,
  canManage=false,
  canManageFeatures=false,
  canManageSecrets=false,
  onNavigate,
}:{
  api:ApiClient;
  canManage?:boolean;
  canManageFeatures?:boolean;
  canManageSecrets?:boolean;
  onNavigate?:(page:string)=>void;
}){
  const[data,setData]=useState<BiblePayload>({providers:[],translations:[],defaultVersionId:'kjv'});
  const[bibleFeature,setBibleFeature]=useState<FeatureItem|null>(null);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState('');
  const[error,setError]=useState('');
  const[success,setSuccess]=useState('');
  const[search,setSearch]=useState('');
  const[providerFilter,setProviderFilter]=useState<'all'|'getbible'|'youversion'>('all');
  const[disableFeatureOpen,setDisableFeatureOpen]=useState(false);
  const[disableReason,setDisableReason]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const[bible,features]=await Promise.all([
        api.request<BiblePayload>('bible?action=platform-config&language=en'),
        api.request<FeaturePayload>('platform-features'),
      ]);
      setData(bible);
      setBibleFeature(features.items?.find(item=>item.key==='bible')??null);
    }catch(value){
      setError(value instanceof Error?value.message:'Unable to load Bible administration.');
    }finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[api]);

  const providerMap=useMemo(()=>new Map(data.providers.map(item=>[item.provider_key,item])),[data.providers]);
  const filteredTranslations=useMemo(()=>{
    const needle=search.trim().toLowerCase();
    return data.translations.filter(item=>{
      if(providerFilter!=='all'&&item.provider!==providerFilter)return false;
      if(!needle)return true;
      return [
        item.abbreviation,item.localized_abbreviation,item.title,item.localized_title,item.language_tag,item.provider,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  },[data.translations,providerFilter,search]);

  const activeTranslations=data.translations.filter(item=>item.runtimeEnabled);
  const youVersionProvider=providerMap.get('youversion');
  const bibleBrainProvider=providerMap.get('bible_brain');

  const saveProvider=async(provider:BibleProvider,enabled:boolean)=>{
    if(!canManage||busy)return;
    setBusy('provider:'+provider.provider_key);setError('');setSuccess('');
    try{
      await api.request('bible',{
        method:'POST',
        body:JSON.stringify({
          action:'platform_provider_save',
          providerKey:provider.provider_key,
          enabled,
          reason:enabled?'Enabled from Bible Experience administration.':'Disabled from Bible Experience administration.',
        }),
      });
      setSuccess(`${provider.display_name} ${enabled?'enabled':'disabled'}.`);
      await load();
    }catch(value){setError(value instanceof Error?value.message:'Unable to update Bible provider.');}
    finally{setBusy('');}
  };

  const saveTranslation=async(item:BibleTranslation,enabled:boolean,makeDefault=false)=>{
    if(!canManage||busy)return;
    setBusy('translation:'+item.provider+':'+item.id);setError('');setSuccess('');
    try{
      await api.request('bible',{
        method:'POST',
        body:JSON.stringify({
          action:'platform_translation_save',
          providerKey:item.provider,
          versionId:String(item.id),
          enabled,
          makeDefault,
          priority:item.priority||100,
          reason:makeDefault?'Selected as the platform Bible default.':enabled?'Enabled for COT members.':'Disabled for COT members.',
        }),
      });
      setSuccess(makeDefault?`${item.abbreviation||item.title} is now the default Bible translation.`:`${item.abbreviation||item.title} ${enabled?'enabled':'disabled'}.`);
      await load();
    }catch(value){setError(value instanceof Error?value.message:'Unable to update Bible translation.');}
    finally{setBusy('');}
  };

  const setBibleAvailability=async(enabled:boolean)=>{
    if(!canManageFeatures||!bibleFeature||busy)return;
    const reason=enabled?'Bible experience enabled from Bible administration.':disableReason.trim();
    if(!enabled&&!reason){setError('Add a reason before disabling the Bible experience.');return;}
    setBusy('feature');setError('');setSuccess('');
    try{
      await api.request('platform-features',{
        method:'PATCH',
        body:JSON.stringify({
          action:'set_global',
          key:'bible',
          enabled,
          rolloutPercentage:bibleFeature.rollout_percentage??100,
          configuration:bibleFeature.configuration??{},
          reason,
        }),
      });
      setSuccess(enabled?'Bible experience enabled.':'Bible experience disabled platform-wide.');
      setDisableFeatureOpen(false);setDisableReason('');
      await load();
    }catch(value){setError(value instanceof Error?value.message:'Unable to update Bible availability.');}
    finally{setBusy('');}
  };

  return <div className="admin-page-stack">
    <Card
      title="Bible experience"
      subtitle="Control the Bible service used across COT. Translation availability is platform-governed; ministry teams still manage Daily Scripture, curated passages and reading plans."
      headerAction={<Button variant="outline" size="sm" onClick={()=>void load()} loading={loading}>Refresh</Button>}
    >
      <div className="admin-stats-grid">
        <StatWidget
          title="Bible"
          value={bibleFeature?.global_enabled?'ON':'OFF'}
          subtitle={bibleFeature?.global_enabled?'Available platform-wide':'Unavailable to member experiences'}
          icon="BIBLE"
          variant={bibleFeature?.global_enabled?'success':'gold'}
        />
        <StatWidget
          title="Default translation"
          value={(data.translations.find(item=>item.isDefault)?.abbreviation||data.defaultVersionId||'KJV').toUpperCase()}
          subtitle="Used when no member preference is available"
          icon="DEFAULT"
        />
        <StatWidget
          title="Active translations"
          value={activeTranslations.length}
          subtitle="Visible and usable by members"
          icon="TEXT"
        />
        <StatWidget
          title="YouVersion"
          value={youVersionProvider?.ready&&youVersionProvider?.enabled?'READY':youVersionProvider?.enabled?'SETUP':'OFF'}
          subtitle={youVersionProvider?.ready?'Publisher key detected':'Requires the YouVersion app key'}
          icon="YV"
          variant={youVersionProvider?.ready&&youVersionProvider?.enabled?'success':'default'}
        />
      </div>
    </Card>

    {error?<div className="admin-inline-error" role="alert">{error}</div>:null}
    {success?<div className="admin-status-message admin-status-success">{success}</div>:null}

    <Card
      title="Bible availability"
      subtitle="This is the platform-wide master switch. Turning it off hides and blocks the Bible experience regardless of translation settings."
    >
      <div className="admin-provider-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <div className="admin-row-title">COT Bible experience</div>
            <div className="admin-row-meta">Reading, search, plans, notes, highlights, Daily Scripture and Scripture previews.</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Badge label={bibleFeature?.global_enabled?'ENABLED':'DISABLED'} variant={bibleFeature?.global_enabled?'active':'suspended'} />
            {canManageFeatures?(
              bibleFeature?.global_enabled
                ? <Button variant="danger" size="sm" disabled={!!busy} onClick={()=>setDisableFeatureOpen(true)}>Disable Bible</Button>
                : <Button variant="primary" size="sm" loading={busy==='feature'} onClick={()=>void setBibleAvailability(true)}>Enable Bible</Button>
            ):<span className="admin-muted">Read only</span>}
          </div>
        </div>
      </div>
    </Card>

    <Card
      title="Bible services"
      subtitle="Provider state is global. A disabled provider cannot be used by a church or member even if a lower-level setting exists."
      headerAction={canManageSecrets&&onNavigate?<Button variant="outline" size="sm" onClick={()=>onNavigate('credentials')}>Secure Credentials</Button>:undefined}
    >
      <div className="admin-provider-grid">
        {data.providers.map(provider=>{
          const isText=provider.provider_kind!=='audio';
          const detail=provider.provider_key==='getbible'
            ? 'Public-domain Bible text. KJV is the current production default; WEB is explicitly disabled below.'
            : provider.provider_key==='youversion'
              ? 'Licensed Bible translations available through the connected YouVersion publisher key.'
              : 'Optional recorded Bible audio. COT Read aloud remains available when recorded audio is unavailable.';
          return <div key={provider.provider_key} className="admin-provider-card">
            <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}>
              <div>
                <h4 style={{margin:0,fontSize:16}}>{provider.display_name}</h4>
                <div style={{color:'var(--text-muted)',fontSize:11,marginTop:4}}>{providerLabel(provider.provider_key)} · {isText?'Bible text':'audio'}</div>
              </div>
              <Badge
                label={!provider.enabled?'DISABLED':provider.ready?'READY':'SETUP NEEDED'}
                variant={!provider.enabled?'suspended':provider.ready?'active':'warning'}
              />
            </div>
            <p style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.6}}>{detail}</p>
            {provider.secretName?<div className="admin-row-meta">Credential name: <strong>{provider.secretName}</strong></div>:null}
            {canManage?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Button
                variant={provider.enabled?'danger':'primary'}
                size="sm"
                disabled={busy==='provider:'+provider.provider_key}
                loading={busy==='provider:'+provider.provider_key}
                onClick={()=>void saveProvider(provider,!provider.enabled)}
              >
                {provider.enabled?'Disable service':'Enable service'}
              </Button>
            </div>:<div className="admin-muted">Read only</div>}
          </div>;
        })}
      </div>
    </Card>

    <Card
      title="Translations"
      subtitle="Only translations that are enabled, available from an enabled provider, and licensed where required appear in the COT Bible version picker."
      headerAction={<div className="admin-header-actions">
        <input
          className="admin-form-input"
          value={search}
          onChange={event=>setSearch(event.target.value)}
          placeholder="Search KJV, NKJV, NIV..."
          aria-label="Search Bible translations"
          style={{minWidth:220}}
        />
        <select className="admin-form-select" value={providerFilter} onChange={event=>setProviderFilter(event.target.value as typeof providerFilter)}>
          <option value="all">All services</option>
          <option value="getbible">Public domain</option>
          <option value="youversion">YouVersion</option>
        </select>
      </div>}
    >
      <Table
        columns={[
          {
            header:'TRANSLATION',
            accessor:(item)=><div>
              <div className="admin-row-title">{item.localized_abbreviation||item.abbreviation||item.id} · {item.localized_title||item.title||'Bible'}</div>
              <div className="admin-row-meta">{item.language_tag||'en'}{item.copyright?` · ${item.copyright}`:''}</div>
            </div>,
          },
          {header:'SERVICE',accessor:(item)=><Badge label={providerLabel(item.provider).toUpperCase()} variant="neutral" />},
          {
            header:'ACCESS',
            accessor:(item)=><Badge
              label={item.provider==='youversion'?(item.available?'LICENSED':'NOT LICENSED'):'PUBLIC DOMAIN'}
              variant={item.provider==='youversion'?(item.available?'active':'warning'):'neutral'}
            />,
          },
          {
            header:'STATE',
            accessor:(item)=><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <Badge label={item.runtimeEnabled?'ACTIVE':item.enabled?'BLOCKED':'DISABLED'} variant={item.runtimeEnabled?'active':item.enabled?'warning':'suspended'} />
              {item.isDefault?<Badge label="DEFAULT" variant="gold" />:null}
            </div>,
          },
          {
            header:'CONTROL',
            accessor:(item)=><div className="admin-table-actions">
              {canManage?<>
                <Button
                  variant={item.enabled?'danger':'outline'}
                  size="sm"
                  disabled={!!busy||(!item.available&&item.provider==='youversion'&&!item.enabled)}
                  loading={busy==='translation:'+item.provider+':'+item.id}
                  onClick={()=>void saveTranslation(item,!item.enabled,false)}
                >
                  {item.enabled?'Disable':'Enable'}
                </Button>
                {!item.isDefault&&item.runtimeEnabled?<Button
                  variant="gold"
                  size="sm"
                  disabled={!!busy}
                  onClick={()=>void saveTranslation(item,true,true)}
                >Set default</Button>:null}
              </>:<span className="admin-muted">Read only</span>}
            </div>,
          },
        ]}
        data={filteredTranslations}
        keyExtractor={item=>item.provider+':'+item.id}
        loading={loading}
        emptyMessage="No translations match this filter."
      />
    </Card>

    <Card
      title="Runtime notes"
      subtitle="What the current configuration means for members."
    >
      <div className="admin-guide-task-list">
        <div className="admin-guide-task"><span>✓</span><p><strong>KJV</strong> is the public-domain production base and current default.</p></div>
        <div className="admin-guide-task"><span>✓</span><p><strong>WEB (World English Bible)</strong> is kept only as a disabled governance entry and is not shown to members.</p></div>
        <div className="admin-guide-task"><span>✓</span><p><strong>YouVersion</strong> translations appear only when the service is enabled, the publisher key is connected, the translation is licensed to that key, and the translation itself is active here.</p></div>
        <div className="admin-guide-task"><span>✓</span><p><strong>Bible Brain</strong> controls recorded audio only. COT text-to-speech Read aloud remains the fallback.</p></div>
      </div>
      {bibleBrainProvider&&!bibleBrainProvider.ready?<div className="admin-warning-callout" style={{marginTop:14}}>Recorded Bible audio is not ready. This does not block KJV text or COT Read aloud.</div>:null}
    </Card>

    <Modal
      isOpen={canManageFeatures&&disableFeatureOpen}
      onClose={()=>{if(!busy){setDisableFeatureOpen(false);setDisableReason('');}}}
      title="Disable the Bible experience?"
      subtitle="This blocks the Bible feature platform-wide. It does not delete saved Bible data."
      footer={<div className="admin-header-actions">
        <Button variant="outline" disabled={!!busy} onClick={()=>{setDisableFeatureOpen(false);setDisableReason('');}}>Cancel</Button>
        <Button variant="danger" loading={busy==='feature'} onClick={()=>void setBibleAvailability(false)}>Disable Bible</Button>
      </div>}
    >
      <InputField
        label="Reason"
        value={disableReason}
        onChange={event=>setDisableReason(event.target.value)}
        placeholder="Maintenance, licensing review, incident..."
        helperText="The reason is written to the Platform Administration audit history."
      />
    </Modal>
  </div>;
}
