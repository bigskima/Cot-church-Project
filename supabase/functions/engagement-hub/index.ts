import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { resolveActiveOrganizationId } from "../_shared/public-organization.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { generateImage, generateVisualScene, imageProviderReadiness } from "../_shared/image-generation.ts";
import { assertObject, requiredString, uuid } from "../_shared/validation.ts";

const BANNER_BUCKET="home-banners";
const DAILY_VISUAL_BUCKET="daily-visuals";
const MINISTRY_GENERATED_BUCKET="ministry-generated-media";
const DAILY_VISUAL_KINDS=new Set(["bible","quote","devotional"]);
const MINISTRY_IMAGE_USE_CASES=new Set(["event_banner","announcement_banner","home_banner","form_banner","sermon_artwork","library_cover","expression_banner"]);
const IMAGE_STYLES=new Set(["auto","photographic","illustrated","minimal","cinematic"]);
const IMAGE_MOODS=new Set(["auto","warm","reflective","energetic","elegant"]);
const FIELD_TYPES=new Set(["text","textarea","email","phone","number","select","checkbox","date"]);
const BANNER_DESTINATIONS=new Set(["none","route","external","event","announcement","form"]);
const BANNER_STATUSES=new Set(["draft","published","hidden","archived"]);
const FORM_STATUSES=new Set(["draft","published","closed","hidden"]);
const DAILY_QUOTE_STATUSES=new Set(["published","hidden"]);

const QUOTE_BANK:Record<string,string[]>={
  peace:[
    "Peace grows when prayer becomes our first response instead of our last resort.",
    "A settled heart is not a life without pressure; it is a life anchored beyond the pressure.",
    "You do not have to control every outcome to walk through today with peace.",
  ],
  faith:[
    "Faith moves before certainty arrives because it trusts the One who leads.",
    "The next faithful step matters more than seeing the whole road at once.",
    "Trust becomes visible when obedience continues even before the answer appears.",
  ],
  hope:[
    "Hope is the courage to expect God to keep working beyond what you can presently see.",
    "A difficult chapter is not permission to conclude that the story is finished.",
    "Hope keeps the heart open to what God can still redeem, rebuild, and restore.",
  ],
  love:[
    "Love becomes powerful when it chooses patience, truth, and service in ordinary moments.",
    "The strongest witness is often a life that keeps choosing love when convenience says otherwise.",
    "Love is not merely something we feel; it is something we practice toward people.",
  ],
  wisdom:[
    "Wisdom is not knowing everything; it is knowing what deserves your obedience today.",
    "A wise decision often begins by becoming quiet enough to hear what hurry was hiding.",
    "Clarity grows when truth is allowed to lead desire instead of following it.",
  ],
  courage:[
    "Courage is not the absence of fear; it is refusing to let fear become your leader.",
    "You can be honest about what scares you and still choose the faithful next step.",
    "Strength often looks like moving forward while your feelings are still catching up.",
  ],
  prayer:[
    "Prayer changes the posture of the heart before it changes the circumstances around it.",
    "Bring God the real weight, not the polished version of what you are carrying.",
    "Prayer is where anxiety is given a name and trust is given room to grow.",
  ],
  grace:[
    "Grace gives you room to grow without pretending you never needed mercy.",
    "You are called to become better without forgetting that transformation begins with grace.",
    "Grace does not excuse a careless life; it empowers a changed one.",
  ],
  strength:[
    "Strength is sometimes the quiet decision to keep showing up with God one more day.",
    "You do not need tomorrow’s strength today; receive enough grace for the step in front of you.",
    "Endurance grows when you stop measuring strength only by how powerful you feel.",
  ],
  purpose:[
    "Purpose is often discovered by serving faithfully where responsibility has already placed you.",
    "You do not need a bigger platform to live a meaningful life today.",
    "Calling becomes clearer when gifts, obedience, and service begin moving in the same direction.",
  ],
  gratitude:[
    "Gratitude trains the heart to notice grace that hurry would normally overlook.",
    "Thankfulness does not deny what is difficult; it refuses to let difficulty become the whole story.",
    "A grateful heart remembers that ordinary mercies are still mercies.",
  ],
  obedience:[
    "Obedience turns conviction into movement.",
    "What you already know to do faithfully may matter more than the answer you are still waiting to receive.",
    "Small acts of obedience can carry consequences much larger than the moment that produced them.",
  ],
  general:[
    "Let today’s Scripture shape not only what you believe, but how you live the next moment.",
    "Truth becomes transformational when it moves from something you admire into something you practice.",
    "Carry one clear truth from Scripture into one deliberate action today.",
  ],
};

function text(value:unknown,max:number,required=false){
  const valueText=String(value??"").trim();
  if(required&&!valueText) throw new ApiError("VALIDATION_FAILED","A required value is missing.",422);
  if(valueText.length>max) throw new ApiError("VALIDATION_FAILED","A value is too long.",422);
  return valueText;
}
function optionalUuid(value:unknown,field:string){
  if(value===null||value===undefined||value==="") return null;
  return uuid(String(value),field,true)!;
}
function iso(value:unknown,field:string){
  if(value===null||value===undefined||value==="") return null;
  const raw=String(value);
  if(Number.isNaN(Date.parse(raw))) throw new ApiError("VALIDATION_FAILED",field+" must be a date and time.",422);
  return raw;
}
function slugify(value:unknown){
  const slug=String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
  if(!slug) throw new ApiError("VALIDATION_FAILED","Add a form slug.",422);
  return slug;
}
function quoteDate(value:unknown,field="date"){
  const raw=String(value??"").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw+"T12:00:00Z"))) throw new ApiError("VALIDATION_FAILED",field+" must be YYYY-MM-DD.",422);
  return raw;
}
function plusDays(date:string,offset:number){
  const next=new Date(date+"T12:00:00Z");
  next.setUTCDate(next.getUTCDate()+offset);
  return next.toISOString().slice(0,10);
}
function stableIndex(value:string,length:number){
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return Math.abs(hash)%(length||1);
}
function normalizedTheme(value:unknown){
  const theme=String(value??"general").trim().toLowerCase();
  const aliases:Record<string,string>={
    anxiety:"peace", worry:"peace", rest:"peace",
    trust:"faith", believe:"faith",
    future:"hope", waiting:"hope",
    mercy:"grace", forgiveness:"grace",
    direction:"wisdom", discernment:"wisdom",
    fear:"courage", boldness:"courage",
    intercession:"prayer",
    endurance:"strength", perseverance:"strength",
    calling:"purpose", service:"purpose",
    joy:"gratitude", thanksgiving:"gratitude",
    surrender:"obedience",
  };
  for(const [needle,key] of Object.entries(aliases)) if(theme.includes(needle)) return key;
  for(const key of Object.keys(QUOTE_BANK)){
    if(key!=="general"&&theme.includes(key)) return key;
  }
  return "general";
}
function automaticQuote(scripture:any,date:string){
  const theme=String(scripture?.theme??"general").trim()||"general";
  const key=normalizedTheme(theme);
  const choices=QUOTE_BANK[key]??QUOTE_BANK.general;
  const body=choices[stableIndex(date+":"+String(scripture?.reference??"")+":"+theme,choices.length)];
  return {
    body,
    sourceReference:String(scripture?.reference??"").trim(),
    theme,
    source:"automatic",
    status:"published",
    isOverride:false,
  };
}
async function resolvedScripture(admin:any,organizationId:string,date:string){
  const {data,error}=await admin.rpc("resolve_daily_scripture",{target_organization_id:organizationId,target_date:date});
  if(error||!data?.[0]) throw new ApiError("DAILY_SCRIPTURE_UNAVAILABLE","Daily Scripture is unavailable for "+date+".",404);
  return data[0];
}
async function canManageDailyHighlights(auth:any,organizationId:string){
  if(!auth?.user) return false;
  const {data}=await auth.client.rpc("has_permission",{target_organization_id:organizationId,requested_permission:"bible.manage",target_branch_id:null});
  return data===true;
}
async function requireDailyHighlightsManager(auth:any,organizationId:string){
  if(!(await canManageDailyHighlights(auth,organizationId))) throw new ApiError("PERMISSION_DENIED","Your ministry role cannot manage Daily Quote or Daily Scripture.",403);
}
async function canManageDevotionals(auth:any,organizationId:string){
  if(!auth?.user) return false;
  for(const permission of ["devotionals.manage","sermons.manage","sermons.create","sermons.publish"]){
    const {data}=await auth.client.rpc("has_permission",{target_organization_id:organizationId,requested_permission:permission,target_branch_id:null});
    if(data===true) return true;
  }
  return false;
}
async function requireVisualManager(auth:any,organizationId:string,kind:string){
  if(kind==="devotional"){
    if(!(await canManageDevotionals(auth,organizationId))) throw new ApiError("PERMISSION_DENIED","Your ministry role cannot manage devotional visuals.",403);
    return;
  }
  await requireDailyHighlightsManager(auth,organizationId);
}
function visualKind(value:unknown){
  const kind=String(value??"").trim().toLowerCase();
  if(!DAILY_VISUAL_KINDS.has(kind)) throw new ApiError("VALIDATION_FAILED","Choose Daily Bible, Daily Quote or Daily Devotional.",422);
  return kind;
}
async function devotionalVisualContent(admin:any,organizationId:string,date:string,seriesId?:string|null){
  const year=Number(date.slice(0,4));
  let seriesQuery=admin.from("devotional_series")
    .select("id,title,author_name,status")
    .eq("organization_id",organizationId)
    .eq("devotional_year",year);
  if(seriesId) seriesQuery=seriesQuery.eq("id",seriesId);
  else seriesQuery=seriesQuery.eq("status","published").order("published_at",{ascending:false});
  const {data:series}=await seriesQuery.limit(12);
  const ids=(series??[]).map((row:any)=>row.id);
  if(ids.length){
    const {data:entry}=await admin.from("devotional_entries")
      .select("series_id,title,scripture,memory_verse,body,prayer")
      .in("series_id",ids)
      .eq("devotional_date",date)
      .limit(1)
      .maybeSingle();
    if(entry){
      const matched=(series??[]).find((row:any)=>row.id===entry.series_id);
      return {title:entry.title||matched?.title||"Daily Devotional",scripture:entry.scripture||entry.memory_verse||"",body:entry.body||"",seriesTitle:matched?.title||""};
    }
  }
  const {data:legacy}=await admin.from("devotionals")
    .select("title,scripture,content")
    .eq("organization_id",organizationId)
    .eq("status","published")
    .eq("publish_date",date)
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(legacy) return {title:legacy.title||"Daily Devotional",scripture:legacy.scripture||"",body:legacy.content||"",seriesTitle:"Daily Devotional"};
  throw new ApiError("DEVOTIONAL_NOT_FOUND","There is no published devotional for this date.",404);
}
async function visualContent(admin:any,organizationId:string,date:string,kind:string,seriesId?:string|null){
  const bible=await resolvedScripture(admin,organizationId,date);
  if(kind==="bible") return {reference:String(bible.reference??""),theme:String(bible.theme??"general"),title:"Daily Bible",body:String(bible.message??"")};
  if(kind==="quote"){
    const {data:saved}=await admin.from("cot_daily_quotes").select("body,source_reference,theme,status").eq("organization_id",organizationId).eq("quote_date",date).maybeSingle();
    const quote=saved&&saved.status!=="hidden"
      ? {body:saved.body,sourceReference:saved.source_reference,theme:saved.theme}
      : automaticQuote(bible,date);
    return {reference:String(quote.sourceReference??bible.reference??""),theme:String(quote.theme??bible.theme??"general"),title:"Daily Quote",body:String(quote.body??"")};
  }
  const devotional=await devotionalVisualContent(admin,organizationId,date,seriesId);
  return {reference:String(devotional.scripture??bible.reference??""),theme:String(bible.theme??"general"),title:String(devotional.title??"Daily Devotional"),body:String(devotional.body??"")};
}
function imageStyle(value:unknown){
  const style=String(value??"auto").trim().toLowerCase();
  return IMAGE_STYLES.has(style)?style:"auto";
}
function imageMood(value:unknown){
  const mood=String(value??"auto").trim().toLowerCase();
  return IMAGE_MOODS.has(mood)?mood:"auto";
}
function imageStyleInstruction(style:string){
  if(style==="photographic") return "Visual treatment: realistic photographic scene, natural skin tones where people appear, believable materials, refined natural lighting, no poster typography.";
  if(style==="illustrated") return "Visual treatment: premium editorial digital illustration with graceful shapes, rich depth and sophisticated painterly detail.";
  if(style==="minimal") return "Visual treatment: restrained minimal composition, few visual elements, generous negative space, clean premium shapes and calm detail.";
  if(style==="cinematic") return "Visual treatment: cinematic composition with atmospheric depth, intentional framing and dramatic but tasteful lighting.";
  return "Visual treatment: choose the most suitable premium visual language from the content itself; prioritize clarity, restraint and strong composition.";
}
function imageMoodInstruction(mood:string){
  if(mood==="warm") return "Mood: warm, welcoming and human, with inviting light and gentle emotional energy.";
  if(mood==="reflective") return "Mood: calm, contemplative, prayerful and spacious.";
  if(mood==="energetic") return "Mood: uplifting, vibrant and active without becoming loud or chaotic.";
  if(mood==="elegant") return "Mood: refined, graceful, polished and visually sophisticated.";
  return "Mood: infer the emotional tone from the content and keep it appropriate for church ministry.";
}
function ministryImageContext(value:unknown){
  const raw=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  return {
    subtitle:text(raw.subtitle??"",500),
    date:text(raw.date??"",120),
    eventType:text(raw.eventType??"",120),
    location:text(raw.location??"",240),
    scripture:text(raw.scripture??"",300),
    excerpt:text(raw.excerpt??"",900),
    theme:text(raw.theme??"",220),
    purpose:text(raw.purpose??"",700),
    category:text(raw.category??"",180),
    speaker:text(raw.speaker??"",180),
    author:text(raw.author??"",180),
  };
}
function dailyVisualSceneSource(kind:string,content:any,direction=""){
  const title=String(content.title??"").slice(0,180);
  const reference=String(content.reference??"").slice(0,160);
  const theme=String(content.theme??"general").slice(0,120);
  const body=String(content.body??"").replace(/\s+/g," ").slice(0,900);
  return [
    "Daily content kind: "+kind+".",
    title?"Title/theme source: "+title+".":"",
    reference?"Scripture reference source: "+reference+".":"",
    theme?"Spiritual theme source: "+theme+".":"",
    body?"Meaning/source copy: "+body+".":"",
    direction?"Optional ministry direction: "+direction+".":"",
  ].filter(Boolean).join(" ");
}
function visualPrompt(kind:string,scene:string,style="auto",mood="auto"){
  const subject=kind==="bible"?"Daily Bible artwork":kind==="quote"?"Daily reflection artwork":"Daily devotional artwork";
  return [
    "Create "+subject+" as a natural visual scene, not a poster, flyer, title card or graphic-design layout.",
    "Scene to render: "+scene,
    imageStyleInstruction(style),
    imageMoodInstruction(mood),
    "Use reverent Christian visual storytelling and a modern premium church-app aesthetic. Symbolism should support the meaning without becoming kitschy or sensational.",
    "There must be no written communication anywhere: no text, typography, letters, words, numbers, scripture, captions, signage, labels, logos, watermarks, screens with writing, pages with writing or interface elements.",
    "Avoid objects whose main purpose is displaying writing. If a book is present, keep it closed, distant, out of focus or turned so no writing is visible.",
    "Leave deliberate clean negative space for COT to overlay the real title or devotional copy after generation.",
    "Avoid depicting identifiable real pastors, authors or public figures. If people help the scene, use natural non-identifiable subjects.",
    "Compose for a wide mobile Home carousel and dedicated detail screen; keep important subjects away from extreme edges.",
  ].filter(Boolean).join(" ");
}
function visualExtension(contentType:string){
  if(contentType==="image/jpeg") return "jpg";
  if(contentType==="image/webp") return "webp";
  return "png";
}
async function readyVisual(admin:any,organizationId:string,date:string,kind:string){
  const {data}=await admin.from("cot_daily_visuals")
    .select("id,visual_date,content_kind,image_url,image_source,provider_code,prompt,status,generated_at,updated_at")
    .eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind).eq("status","ready").maybeSingle();
  return data??null;
}

async function autoGenerateVisual(admin:any,organizationId:string,date:string,kind:"bible"|"devotional"){
  const {data:existing}=await admin.from("cot_daily_visuals")
    .select("id,status,updated_at")
    .eq("organization_id",organizationId)
    .eq("visual_date",date)
    .eq("content_kind",kind)
    .maybeSingle();
  if(existing) return;

  let content:any;
  try{content=await visualContent(admin,organizationId,date,kind);}
  catch{return;}

  const signal=new AbortController().signal;
  const scene=await generateVisualScene(admin,{
    useCase:"daily_"+kind,
    source:dailyVisualSceneSource(kind,content),
    style:"auto",
    mood:"auto",
  },signal);
  const prompt=visualPrompt(kind,scene);
  const {error:claimError}=await admin.from("cot_daily_visuals").insert({
    organization_id:organizationId,
    visual_date:date,
    content_kind:kind,
    image_url:null,
    storage_path:null,
    image_source:"ai",
    provider_code:null,
    prompt,
    status:"generating",
    last_error:"",
    generated_at:null,
    created_by:null,
    updated_at:new Date().toISOString(),
  });
  if(claimError) return;

  try{
    const generated=await generateImage(admin,prompt,signal);
    const ext=visualExtension(generated.contentType);
    const storagePath="orgs/"+organizationId+"/"+kind+"/"+date+"/auto-"+crypto.randomUUID()+"."+ext;
    const {error:uploadError}=await admin.storage.from(DAILY_VISUAL_BUCKET).upload(storagePath,generated.bytes,{contentType:generated.contentType,upsert:false});
    if(uploadError) throw new Error("Generated image storage failed.");
    const imageUrl=admin.storage.from(DAILY_VISUAL_BUCKET).getPublicUrl(storagePath).data.publicUrl;
    await admin.from("cot_daily_visuals").update({
      image_url:imageUrl,
      storage_path:storagePath,
      image_source:"ai",
      provider_code:generated.providerCode,
      prompt,
      status:"ready",
      last_error:"",
      generated_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind);
  }catch(value){
    const message=value instanceof Error?value.message:"Automatic image generation failed.";
    await admin.from("cot_daily_visuals").update({
      status:"failed",
      last_error:message.slice(0,1000),
      updated_at:new Date().toISOString(),
    }).eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind);
  }
}

async function ensureAutomaticTodayVisuals(admin:any,organizationId:string,date:string){
  const provider=await imageProviderReadiness(admin).catch(()=>null);
  if(!provider?.configured) return;

  await Promise.allSettled([
    autoGenerateVisual(admin,organizationId,date,"bible"),
    autoGenerateVisual(admin,organizationId,date,"devotional"),
  ]);

  const [{data:quoteVisual},bibleVisual]=await Promise.all([
    admin.from("cot_daily_visuals").select("id").eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind","quote").maybeSingle(),
    readyVisual(admin,organizationId,date,"bible"),
  ]);
  if(!quoteVisual&&bibleVisual?.image_url){
    await admin.from("cot_daily_visuals").insert({
      organization_id:organizationId,
      visual_date:date,
      content_kind:"quote",
      image_url:bibleVisual.image_url,
      storage_path:null,
      image_source:"inherited",
      provider_code:bibleVisual.provider_code??null,
      prompt:"",
      status:"ready",
      last_error:"",
      generated_at:bibleVisual.generated_at??null,
      created_by:null,
      updated_at:new Date().toISOString(),
    });
  }
}

function runInBackground(task:Promise<unknown>){
  const runtime=(globalThis as any).EdgeRuntime;
  if(runtime?.waitUntil) runtime.waitUntil(task);
  else void task;
}

async function canManage(auth:any,organizationId:string){
  if(!auth?.user) return false;
  for(const permission of ["announcements.manage","events.create","events.update"]){
    const {data}=await auth.client.rpc("has_permission",{target_organization_id:organizationId,requested_permission:permission,target_branch_id:null});
    if(data===true) return true;
  }
  return false;
}
async function requireManager(auth:any,organizationId:string){
  if(!(await canManage(auth,organizationId))) throw new ApiError("PERMISSION_DENIED","Your ministry role cannot manage banners or forms.",403);
}
async function hasOrgPermission(auth:any,organizationId:string,permission:string,branchId:string|null=null){
  if(!auth?.user) return false;
  const {data}=await auth.client.rpc("has_permission",{target_organization_id:organizationId,requested_permission:permission,target_branch_id:branchId});
  return data===true;
}
function ministryImageUseCase(value:unknown){
  const useCase=String(value??"").trim().toLowerCase();
  if(!MINISTRY_IMAGE_USE_CASES.has(useCase)) throw new ApiError("VALIDATION_FAILED","Choose a supported ministry image type.",422);
  return useCase;
}
async function requireMinistryImagePermission(auth:any,organizationId:string,useCase:string,branchId:string|null=null){
  if(!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED","Sign in to generate ministry artwork.",401);
  if(useCase==="event_banner"){
    if(await hasOrgPermission(auth,organizationId,"events.create",branchId)||await hasOrgPermission(auth,organizationId,"events.update",branchId)) return;
  }else if(useCase==="announcement_banner"){
    if(await hasOrgPermission(auth,organizationId,"announcements.manage",branchId)) return;
  }else if(useCase==="sermon_artwork"){
    for(const permission of ["sermons.manage","sermons.create","sermons.publish"]){
      if(await hasOrgPermission(auth,organizationId,permission,branchId)) return;
    }
  }else if(useCase==="expression_banner"){
    if(branchId&&await hasOrgPermission(auth,organizationId,"branches.update",branchId)) return;
  }else if(useCase==="library_cover"){
    for(const permission of ["sermons.manage","sermons.create","sermons.publish"]){
      if(await hasOrgPermission(auth,organizationId,permission,null)) return;
    }
  }else if(useCase==="home_banner"||useCase==="form_banner"){
    if(await canManage(auth,organizationId)) return;
  }
  throw new ApiError("PERMISSION_DENIED","Your ministry role cannot generate artwork for this content.",403);
}
function ministrySceneSource(useCase:string,title:string,description:string,context:ReturnType<typeof ministryImageContext>,direction:string){
  return [
    "Use case: "+useCase+".",
    title?"Primary ministry title/source: "+title+".":"",
    description?"Supporting ministry copy/source: "+description+".":"",
    context.subtitle?"Subtitle/source: "+context.subtitle+".":"",
    context.date?"Date/time/source: "+context.date+".":"",
    context.eventType?"Event format/source: "+context.eventType+".":"",
    context.location?"Location/source: "+context.location+".":"",
    context.scripture?"Scripture/source: "+context.scripture+".":"",
    context.excerpt?"Message excerpt/source: "+context.excerpt+".":"",
    context.theme?"Theme/source: "+context.theme+".":"",
    context.purpose?"Purpose/source: "+context.purpose+".":"",
    context.category?"Category/source: "+context.category+".":"",
    context.speaker?"Speaker/source: "+context.speaker+".":"",
    context.author?"Author/source: "+context.author+".":"",
    direction?"Optional ministry direction/source: "+direction+".":"",
  ].filter(Boolean).join(" ");
}
function ministryImagePrompt(useCase:string,scene:string,style:string,mood:string){
  const framing=useCase==="library_cover"
    ?"Use a strong 2:3 portrait editorial composition with deliberate clear space for COT to render the real book title and metadata later."
    :useCase==="home_banner"||useCase==="form_banner"
      ?"Use a responsive wide 16:7 composition with deliberate clear space for COT interface text later."
      :"Use a responsive wide 16:9 composition with deliberate clear space for COT interface text later.";
  return [
    "Create premium original ministry artwork as a natural visual scene, never as a poster, flyer, title card, advertisement or graphic-design layout.",
    "Scene to render: "+scene,
    imageStyleInstruction(style),
    imageMoodInstruction(mood),
    framing,
    "Use a polished, reverent, contemporary Christian visual language. Avoid kitsch, sensationalism, horror, gore and misleading depictions of real identifiable people.",
    "There must be no written communication anywhere: no text, typography, letters, words, numbers, Bible verses, captions, title cards, poster copy, labels, logos, watermarks, UI, readable signage, screens with writing or pages with writing.",
    "Avoid objects whose main purpose is displaying writing. If a book is present, keep it closed, distant, out of focus or positioned so no writing is visible.",
    "COT will add every real title, date, scripture reference and call-to-action separately after generation.",
  ].filter(Boolean).join(" ");
}
function ministryImageDimensions(useCase:string){
  if(useCase==="library_cover") return {width:800,height:1200};
  if(useCase==="home_banner"||useCase==="form_banner") return {width:1280,height:560};
  return {width:1280,height:720};
}
async function resolveOrganization(auth:any,url:URL,body?:Record<string,unknown>){
  const requested=body?.organizationId?String(body.organizationId):url.searchParams.get("organizationId")??auth?.organizationId??null;
  try{return await resolveActiveOrganizationId(adminClient(),requested);}
  catch{throw new ApiError("ORGANIZATION_REQUIRED","Choose a church to continue.",422);}
}
function normalizeFields(value:unknown){
  const fields=Array.isArray(value)?value:[];
  if(!fields.length) throw new ApiError("VALIDATION_FAILED","Add at least one form field.",422);
  if(fields.length>40) throw new ApiError("VALIDATION_FAILED","A form can contain up to 40 fields.",422);
  const ids=new Set<string>();
  return fields.map((raw:any,index:number)=>{
    const id=String(raw?.id??raw?.label??("field-"+(index+1))).trim().toLowerCase().replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,"").slice(0,50);
    if(!id||ids.has(id)) throw new ApiError("VALIDATION_FAILED","Every form field needs a unique key.",422);
    ids.add(id);
    const type=String(raw?.type??"text");
    if(!FIELD_TYPES.has(type)) throw new ApiError("VALIDATION_FAILED","Unsupported form field type.",422);
    const options=type==="select"
      ? (Array.isArray(raw?.options)?raw.options:[]).map((item:any)=>text(item,120)).filter(Boolean).slice(0,50)
      : [];
    if(type==="select"&&!options.length) throw new ApiError("VALIDATION_FAILED","Select fields need at least one option.",422);
    return {
      id,
      label:text(raw?.label??("Field "+(index+1)),160,true),
      type,
      required:Boolean(raw?.required),
      placeholder:text(raw?.placeholder??"",200),
      help:text(raw?.help??"",500),
      options,
    };
  });
}
function validateSubmission(fields:any[],value:unknown){
  const incoming=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const cleaned:Record<string,unknown>={};
  for(const field of fields){
    const raw=incoming[field.id];
    if(field.type==="checkbox"){
      const checked=raw===true||raw==="true"||raw===1;
      if(field.required&&!checked) throw new ApiError("VALIDATION_FAILED",field.label+" is required.",422);
      cleaned[field.id]=checked;
      continue;
    }
    if(field.type==="number"){
      if(raw===undefined||raw===null||raw===""){
        if(field.required) throw new ApiError("VALIDATION_FAILED",field.label+" is required.",422);
        cleaned[field.id]=null; continue;
      }
      const number=Number(raw);
      if(!Number.isFinite(number)) throw new ApiError("VALIDATION_FAILED",field.label+" must be a number.",422);
      cleaned[field.id]=number; continue;
    }
    const valueText=text(raw??"",5000);
    if(field.required&&!valueText) throw new ApiError("VALIDATION_FAILED",field.label+" is required.",422);
    if(field.type==="email"&&valueText&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueText)) throw new ApiError("VALIDATION_FAILED","Enter a valid email address.",422);
    if(field.type==="select"&&valueText&&!field.options.includes(valueText)) throw new ApiError("VALIDATION_FAILED","Choose a valid option for "+field.label+".",422);
    if(field.type==="date"&&valueText&&Number.isNaN(Date.parse(valueText))) throw new ApiError("VALIDATION_FAILED","Choose a valid date for "+field.label+".",422);
    cleaned[field.id]=valueText;
  }
  return cleaned;
}
async function profileMap(admin:any,profileIds:string[]){
  const ids=[...new Set(profileIds.filter(Boolean))];
  if(!ids.length) return new Map<string,any>();
  const {data}=await admin.from("profiles").select("id,display_name,username,avatar_url").in("id",ids);
  return new Map((data??[]).map((profile:any)=>[profile.id,profile]));
}

export const engagementHubHandler=createHandler(
  {methods:["GET","POST","DELETE"],authentication:"optional",organization:"optional"},
  async({request,auth})=>{
    const admin=adminClient();
    const url=new URL(request.url);
    const action=url.searchParams.get("action")??"home";

    if(request.method==="GET"){
      const organizationId=await resolveOrganization(auth,url);

      if(action==="home"){
        const now=new Date().toISOString();
        const today=now.slice(0,10);
        const [bannerResult,formResult,eventResult,announcementResult,scripture,storedQuote,visualRows,dailyDevotional]=await Promise.all([
          admin.from("cot_home_banners")
            .select("id,title,subtitle,image_url,destination_type,destination_value,priority,starts_at,ends_at")
            .eq("organization_id",organizationId)
            .eq("status","published")
            .or("starts_at.is.null,starts_at.lte."+now)
            .or("ends_at.is.null,ends_at.gte."+now)
            .order("priority",{ascending:false})
            .order("created_at",{ascending:false})
            .limit(20),
          admin.from("cot_forms")
            .select("id,slug,title,description,banner_image_url,updated_at")
            .eq("organization_id",organizationId)
            .eq("status","published")
            .order("updated_at",{ascending:false})
            .limit(12),
          admin.from("events")
            .select("id,title,description,banner_url,visibility,starts_at,ends_at")
            .eq("organization_id",organizationId)
            .is("branch_id",null)
            .eq("status","published")
            .gte("ends_at",now)
            .in("visibility",auth?.user?["public","members"]:["public"])
            .order("starts_at",{ascending:true})
            .limit(10),
          auth?.user
            ? admin.from("announcements")
                .select("id,title,body,banner_url,published_at")
                .eq("organization_id",organizationId)
                .is("branch_id",null)
                .eq("status","published")
                .order("published_at",{ascending:false,nullsFirst:false})
                .limit(10)
            : Promise.resolve({data:[] as any[],error:null}),
          resolvedScripture(admin,organizationId,today).catch(()=>null),
          admin.from("cot_daily_quotes").select("id,quote_date,body,source_reference,theme,source,status").eq("organization_id",organizationId).eq("quote_date",today).maybeSingle(),
          admin.from("cot_daily_visuals").select("id,visual_date,content_kind,image_url,image_source,provider_code,prompt,status,generated_at,updated_at").eq("organization_id",organizationId).eq("visual_date",today).eq("status","ready"),
          devotionalVisualContent(admin,organizationId,today).catch(()=>null),
        ]);
        if(bannerResult.error||formResult.error||eventResult.error||announcementResult.error||(visualRows as any)?.error) throw new ApiError("HOME_BANNERS_FAILED","Unable to load COT highlights.",500,undefined,false);
        const explicitBanners=bannerResult.data??[];
        const explicitDestinations=new Set(explicitBanners
          .filter((item:any)=>item.destination_type!=="none"&&item.destination_value)
          .map((item:any)=>item.destination_type+":"+String(item.destination_value)));
        const automaticFormBanners=(formResult.data??[])
          .filter((form:any)=>!explicitDestinations.has("form:"+String(form.slug)))
          .map((form:any)=>({
            id:"form:"+form.id,
            title:form.title,
            subtitle:form.description||"Open this COT form to respond.",
            image_url:form.banner_image_url??null,
            destination_type:"form",
            destination_value:form.slug,
            priority:0,
            starts_at:null,
            ends_at:null,
            source:"published_form",
          }));
        const automaticEventBanners=(eventResult.data??[])
          .filter((event:any)=>!explicitDestinations.has("event:"+String(event.id)))
          .map((event:any)=>({
            id:"event:"+event.id,
            title:event.title,
            subtitle:event.description||("Starts "+new Date(event.starts_at).toLocaleString()),
            image_url:event.banner_url??null,
            destination_type:"event",
            destination_value:event.id,
            priority:0,
            starts_at:event.starts_at,
            ends_at:event.ends_at,
            source:"published_event",
          }));
        const automaticAnnouncementBanners=(announcementResult.data??[])
          .filter((announcement:any)=>!explicitDestinations.has("announcement:"+String(announcement.id)))
          .map((announcement:any)=>({
            id:"announcement:"+announcement.id,
            title:announcement.title,
            subtitle:announcement.body||"Open this COT announcement.",
            image_url:announcement.banner_url??null,
            destination_type:"announcement",
            destination_value:announcement.id,
            priority:0,
            starts_at:announcement.published_at??null,
            ends_at:null,
            source:"published_announcement",
          }));
        const stored=(storedQuote as any)?.data??null;
        const dailyVisuals=Object.fromEntries((((visualRows as any)?.data??[]) as any[]).map((row:any)=>[row.content_kind,row]));
        const dailyQuote=stored
          ? stored.status==="hidden" ? null : {
              id:stored.id,
              body:stored.body,
              sourceReference:stored.source_reference,
              theme:stored.theme,
              source:stored.source,
              status:stored.status,
              isOverride:true,
            }
          : scripture ? automaticQuote(scripture,today) : null;
        runInBackground(ensureAutomaticTodayVisuals(admin,organizationId,today));
        return {data:{banners:[...explicitBanners,...automaticAnnouncementBanners,...automaticEventBanners,...automaticFormBanners],dailyQuote,dailyVisuals,dailyDevotional}};
      }

      if(action==="form"){
        const id=url.searchParams.get("id");
        const slug=url.searchParams.get("slug");
        if(!id&&!slug) throw new ApiError("VALIDATION_FAILED","Choose a form.",422);
        let query=admin.from("cot_forms").select("*").eq("organization_id",organizationId);
        query=id?query.eq("id",uuid(id,"id",true)!):query.eq("slug",String(slug));
        const {data,error}=await query.maybeSingle();
        if(error||!data) throw new ApiError("FORM_NOT_FOUND","This form is unavailable.",404);
        if(data.status!=="published"&&!(await canManage(auth,organizationId))) throw new ApiError("FORM_NOT_FOUND","This form is unavailable.",404);
        return {data};
      }

      if(action==="forms"){
        const manager=await canManage(auth,organizationId);
        let query=admin.from("cot_forms").select("id,organization_id,slug,title,description,status,fields,submit_label,success_message,requires_auth,banner_image_url,created_at,updated_at").eq("organization_id",organizationId).order("updated_at",{ascending:false});
        if(!manager) query=query.eq("status","published");
        const {data,error}=await query.limit(100);
        if(error) throw new ApiError("FORMS_LOAD_FAILED","Unable to load forms.",500,undefined,false);
        return {data:data??[]};
      }

      if(action==="daily_highlights_manage"){
        await requireDailyHighlightsManager(auth,organizationId);
        const fromDate=quoteDate(url.searchParams.get("fromDate")??new Date().toISOString().slice(0,10),"fromDate");
        const dayCount=Math.max(1,Math.min(30,Number(url.searchParams.get("days")??30)||30));
        const dates=Array.from({length:dayCount},(_,index)=>plusDays(fromDate,index));
        const [{data:stored,error:storedError},{data:visuals,error:visualError},provider]=await Promise.all([
          admin.from("cot_daily_quotes")
            .select("id,quote_date,body,source_reference,theme,source,status,updated_at")
            .eq("organization_id",organizationId)
            .gte("quote_date",dates[0])
            .lte("quote_date",dates[dates.length-1]),
          admin.from("cot_daily_visuals")
            .select("id,visual_date,content_kind,image_url,image_source,provider_code,prompt,status,last_error,generated_at,updated_at")
            .eq("organization_id",organizationId)
            .gte("visual_date",dates[0])
            .lte("visual_date",dates[dates.length-1]),
          imageProviderReadiness(admin),
        ]);
        if(storedError||visualError) throw new ApiError("DAILY_QUOTES_LOAD_FAILED","Unable to load Daily Highlights schedule.",500,undefined,false);
        const byDate=new Map((stored??[]).map((row:any)=>[row.quote_date,row]));
        const visualMap=new Map<string,any>();
        for(const row of visuals??[]) visualMap.set(row.visual_date+":"+row.content_kind,row);
        const days=await Promise.all(dates.map(async(date)=>{
          const bible=await resolvedScripture(admin,organizationId,date);
          const automatic=automaticQuote(bible,date);
          const saved:any=byDate.get(date)??null;
          const quote=saved?{
            id:saved.id,
            body:saved.body,
            sourceReference:saved.source_reference,
            theme:saved.theme,
            source:saved.source,
            status:saved.status,
            isOverride:true,
            updatedAt:saved.updated_at,
          }:automatic;
          return {
            date,bible,automaticQuote:automatic,quote,
            visuals:{
              bible:visualMap.get(date+":bible")??null,
              quote:visualMap.get(date+":quote")??null,
              devotional:visualMap.get(date+":devotional")??null,
            },
          };
        }));
        return {data:{fromDate,days,provider}};
      }

      if(action==="daily_quote"){
        const date=quoteDate(url.searchParams.get("date")??new Date().toISOString().slice(0,10));
        const bible=await resolvedScripture(admin,organizationId,date);
        const [{data:saved},visual]=await Promise.all([
          admin.from("cot_daily_quotes")
            .select("id,quote_date,body,source_reference,theme,source,status,updated_at")
            .eq("organization_id",organizationId)
            .eq("quote_date",date)
            .maybeSingle(),
          readyVisual(admin,organizationId,date,"quote"),
        ]);
        const quote=saved
          ? saved.status==="hidden" ? null : {
              id:saved.id,
              date:saved.quote_date,
              body:saved.body,
              sourceReference:saved.source_reference,
              theme:saved.theme,
              source:saved.source,
              isOverride:true,
            }
          : {...automaticQuote(bible,date),date};
        return {data:quote?{...quote,visual:visual??await readyVisual(admin,organizationId,date,"bible")}:null};
      }

      if(action==="daily_visual"){
        const date=quoteDate(url.searchParams.get("date")??new Date().toISOString().slice(0,10));
        const kind=visualKind(url.searchParams.get("kind"));
        return {data:await readyVisual(admin,organizationId,date,kind)};
      }

      if(action==="daily_visual_manage"){
        const date=quoteDate(url.searchParams.get("date")??new Date().toISOString().slice(0,10));
        const kind=visualKind(url.searchParams.get("kind"));
        await requireVisualManager(auth,organizationId,kind);
        const [{data:visual},provider]=await Promise.all([
          admin.from("cot_daily_visuals")
            .select("id,visual_date,content_kind,image_url,storage_path,image_source,provider_code,prompt,status,last_error,generated_at,updated_at")
            .eq("organization_id",organizationId)
            .eq("visual_date",date)
            .eq("content_kind",kind)
            .maybeSingle(),
          imageProviderReadiness(admin),
        ]);
        return {data:{visual:visual??null,provider}};
      }

      if(action==="manage"){
        await requireManager(auth,organizationId);
        const [banners,forms,events,announcements]=await Promise.all([
          admin.from("cot_home_banners").select("*").eq("organization_id",organizationId).order("priority",{ascending:false}).order("updated_at",{ascending:false}),
          admin.from("cot_forms").select("*").eq("organization_id",organizationId).order("updated_at",{ascending:false}),
          admin.from("events").select("id,title,status,starts_at,ends_at,banner_url").eq("organization_id",organizationId).order("starts_at",{ascending:false}).limit(200),
          admin.from("announcements").select("id,title,status,scheduled_for,published_at,banner_url").eq("organization_id",organizationId).order("updated_at",{ascending:false}).limit(200),
        ]);
        return {data:{
          banners:banners.data??[],
          forms:forms.data??[],
          events:events.data??[],
          announcements:announcements.data??[],
        }};
      }

      if(action==="submissions"){
        await requireManager(auth,organizationId);
        const formId=uuid(requiredString(url.searchParams.get("formId"),"formId",36),"formId",true)!;
        const {data:rows,error}=await admin.from("cot_form_submissions").select("*").eq("organization_id",organizationId).eq("form_id",formId).order("created_at",{ascending:false}).limit(1000);
        if(error) throw new ApiError("FORM_RESPONSES_FAILED","Unable to load form responses.",500,undefined,false);
        const profiles=await profileMap(admin,(rows??[]).map((row:any)=>row.profile_id).filter(Boolean));
        return {data:(rows??[]).map((row:any)=>({...row,profile:row.profile_id?profiles.get(row.profile_id)??null:null}))};
      }

      if(action==="event_interest"){
        if(!auth?.user) return {data:{interested:false}};
        const eventId=uuid(requiredString(url.searchParams.get("eventId"),"eventId",36),"eventId",true)!;
        const {data}=await admin.from("cot_event_interests").select("event_id").eq("event_id",eventId).eq("profile_id",auth.user.id).maybeSingle();
        return {data:{interested:Boolean(data)}};
      }

      if(action==="event_responses"){
        await requireManager(auth,organizationId);
        const eventId=uuid(requiredString(url.searchParams.get("eventId"),"eventId",36),"eventId",true)!;
        const {data:event,error:eventError}=await admin.from("events").select("id,response_form_id").eq("organization_id",organizationId).eq("id",eventId).maybeSingle();
        if(eventError||!event) throw new ApiError("EVENT_NOT_FOUND","This event is unavailable.",404);
        const [{data:interests},{data:registrations},{data:form}]=await Promise.all([
          admin.from("cot_event_interests").select("profile_id,created_at").eq("organization_id",organizationId).eq("event_id",eventId).order("created_at",{ascending:false}),
          admin.from("event_registrations").select("id,membership_id,status,registered_at").eq("organization_id",organizationId).eq("event_id",eventId).order("registered_at",{ascending:false}),
          event.response_form_id
            ? admin.from("cot_forms").select("id,slug,title,fields,status").eq("organization_id",organizationId).eq("id",event.response_form_id).maybeSingle()
            : Promise.resolve({data:null,error:null}),
        ]);
        const {data:formSubmissions}=event.response_form_id
          ? await admin.from("cot_form_submissions").select("id,profile_id,values,status,created_at").eq("organization_id",organizationId).eq("form_id",event.response_form_id).order("created_at",{ascending:false}).limit(1000)
          : {data:[] as any[]};
        const membershipIds=(registrations??[]).map((row:any)=>row.membership_id).filter(Boolean);
        const {data:memberships}=membershipIds.length
          ? await admin.from("memberships").select("id,profile_id").in("id",membershipIds)
          : {data:[] as any[]};
        const memberMap=new Map((memberships??[]).map((row:any)=>[row.id,row.profile_id]));
        const ids=[
          ...(interests??[]).map((row:any)=>row.profile_id),
          ...(registrations??[]).map((row:any)=>memberMap.get(row.membership_id)).filter(Boolean),
          ...(formSubmissions??[]).map((row:any)=>row.profile_id).filter(Boolean),
        ];
        const profiles=await profileMap(admin,ids as string[]);
        return {data:{
          interested:(interests??[]).map((row:any)=>({...row,profile:profiles.get(row.profile_id)??null})),
          registered:(registrations??[]).map((row:any)=>({...row,profile:profiles.get(memberMap.get(row.membership_id))??null})),
          form:form??null,
          formResponses:(formSubmissions??[]).map((row:any)=>({...row,profile:row.profile_id?profiles.get(row.profile_id)??null:null})),
        }};
      }

      throw new ApiError("NOT_FOUND","Engagement action not recognized.",404);
    }

    const body=assertObject(await jsonBody(request));
    const actionName=requiredString(body.action,"action",60);

    if(actionName==="form_submit"){
      const organizationId=await resolveOrganization(auth,url,body);
      const formId=optionalUuid(body.formId,"formId");
      const formSlug=body.slug?String(body.slug):null;
      let query=admin.from("cot_forms").select("*").eq("organization_id",organizationId).eq("status","published");
      query=formId?query.eq("id",formId):query.eq("slug",formSlug??"");
      const {data:form,error}=await query.maybeSingle();
      if(error||!form) throw new ApiError("FORM_NOT_FOUND","This form is unavailable.",404);
      if(form.requires_auth&&!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED","Sign in to submit this form.",401);
      const values=validateSubmission(Array.isArray(form.fields)?form.fields:[],body.values);
      const {data:saved,error:saveError}=await admin.from("cot_form_submissions").insert({
        form_id:form.id,organization_id:organizationId,profile_id:auth?.user?.id??null,values,
      }).select().single();
      if(saveError) throw new ApiError("FORM_SUBMIT_FAILED","Unable to submit this form.",500,undefined,false);
      return {data:{id:saved.id,successMessage:form.success_message},status:201};
    }

    if(actionName==="event_interest"){
      if(!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED","Sign in to mark an event as interesting.",401);
      const eventId=uuid(requiredString(body.eventId,"eventId",36),"eventId",true)!;
      const {data:event,error}=await admin.from("events").select("id,organization_id,status,visibility").eq("id",eventId).maybeSingle();
      if(error||!event||event.status!=="published") throw new ApiError("EVENT_NOT_FOUND","This event is unavailable.",404);
      const interested=body.interested!==false;
      if(interested){
        const {error:upsertError}=await admin.from("cot_event_interests").upsert({
          event_id:eventId,organization_id:event.organization_id,profile_id:auth.user.id,updated_at:new Date().toISOString(),
        });
        if(upsertError) throw new ApiError("EVENT_INTEREST_FAILED","Unable to save your interest.",500,undefined,false);
      }else{
        await admin.from("cot_event_interests").delete().eq("event_id",eventId).eq("profile_id",auth.user.id);
      }
      return {data:{eventId,interested}};
    }

    const organizationId=await resolveOrganization(auth,url,body);

    if(actionName==="ministry_image_generate"){
      const useCase=ministryImageUseCase(body.useCase);
      const branchId=optionalUuid(body.branchId,"branchId");
      await requireMinistryImagePermission(auth,organizationId,useCase,branchId);
      const title=text(body.title,220,true);
      const description=text(body.description??"",1800);
      const context=ministryImageContext(body.context);
      const style=imageStyle(body.style);
      const mood=imageMood(body.mood);
      const direction=text(body.direction??"",1200);
      const scene=await generateVisualScene(admin,{
        useCase,
        source:ministrySceneSource(useCase,title,description,context,direction),
        style,
        mood,
      },request.signal);
      const prompt=ministryImagePrompt(useCase,scene,style,mood);
      const dimensions=ministryImageDimensions(useCase);
      const generated=await generateImage(admin,prompt,request.signal,dimensions);
      const ext=visualExtension(generated.contentType);
      const storagePath="orgs/"+organizationId+"/"+useCase+"/"+new Date().toISOString().slice(0,10)+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await admin.storage.from(MINISTRY_GENERATED_BUCKET).upload(storagePath,generated.bytes,{contentType:generated.contentType,upsert:false});
      if(uploadError) throw new ApiError("MINISTRY_IMAGE_STORAGE_FAILED","The artwork was generated but could not be stored.",500,undefined,false);
      const publicUrl=admin.storage.from(MINISTRY_GENERATED_BUCKET).getPublicUrl(storagePath).data.publicUrl;
      const {error:auditError}=await admin.from("cot_ministry_generated_media").insert({
        organization_id:organizationId,
        use_case:useCase,
        image_url:publicUrl,
        storage_path:storagePath,
        provider_code:generated.providerCode,
        model:generated.model,
        prompt,
        style,
        mood,
        advanced_direction:direction,
        created_by:auth.user.id,
      });
      if(auditError) console.warn("ministry generated media audit failed",auditError.message);
      return {data:{publicUrl,storagePath,providerCode:generated.providerCode,model:generated.model,style,mood}};
    }

    if(["visual_upload_intent","visual_save_upload","visual_generate","visual_inherit","visual_clear"].includes(actionName)){
      if(!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED","Sign in to manage Daily visuals.",401);
      const kind=visualKind(body.kind);
      const date=quoteDate(body.date);
      await requireVisualManager(auth,organizationId,kind);

      if(actionName==="visual_upload_intent"){
        const mimeType=text(body.mimeType,80,true).toLowerCase();
        const ext=mimeType==="image/png"?"png":mimeType==="image/webp"?"webp":mimeType==="image/jpeg"?"jpg":null;
        if(!ext) throw new ApiError("UNSUPPORTED_MEDIA_TYPE","Choose a JPG, PNG, or WebP image.",415);
        const storagePath="orgs/"+organizationId+"/"+kind+"/"+date+"/"+auth.user.id+"/"+crypto.randomUUID()+"."+ext;
        const {data,error}=await admin.storage.from(DAILY_VISUAL_BUCKET).createSignedUploadUrl(storagePath,{upsert:false});
        if(error||!data?.signedUrl) throw new ApiError("UPLOAD_SESSION_FAILED","Unable to prepare the Daily visual upload.",500,undefined,false);
        return {data:{
          signedUploadUrl:data.signedUrl,
          storagePath,
          publicUrl:admin.storage.from(DAILY_VISUAL_BUCKET).getPublicUrl(storagePath).data.publicUrl,
        }};
      }

      if(actionName==="visual_save_upload"){
        const storagePath=text(body.storagePath,800,true);
        const prefix="orgs/"+organizationId+"/"+kind+"/"+date+"/"+auth.user.id+"/";
        if(!storagePath.startsWith(prefix)) throw new ApiError("DAILY_VISUAL_UPLOAD_INVALID","This visual upload does not belong to this ministry account.",403);
        const {data:existing}=await admin.from("cot_daily_visuals").select("storage_path,image_source").eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind).maybeSingle();
        const imageUrl=admin.storage.from(DAILY_VISUAL_BUCKET).getPublicUrl(storagePath).data.publicUrl;
        const {data,error}=await admin.from("cot_daily_visuals").upsert({
          organization_id:organizationId,
          visual_date:date,
          content_kind:kind,
          image_url:imageUrl,
          storage_path:storagePath,
          image_source:"upload",
          provider_code:null,
          prompt:"",
          status:"ready",
          last_error:"",
          generated_at:null,
          created_by:auth.user.id,
          updated_at:new Date().toISOString(),
        },{onConflict:"organization_id,visual_date,content_kind"}).select("*").single();
        if(error) throw new ApiError("DAILY_VISUAL_SAVE_FAILED","Unable to attach this image.",500,undefined,false);
        if(existing?.storage_path&&existing.storage_path!==storagePath&&existing.image_source!=="inherited") await admin.storage.from(DAILY_VISUAL_BUCKET).remove([existing.storage_path]).catch(()=>{});
        return {data};
      }

      if(actionName==="visual_inherit"){
        if(kind!=="quote") throw new ApiError("VALIDATION_FAILED","Only Daily Quote can inherit the Daily Bible image.",422);
        const bibleVisual=await readyVisual(admin,organizationId,date,"bible");
        if(!bibleVisual?.image_url) throw new ApiError("DAILY_VISUAL_SOURCE_MISSING","Generate or upload the Daily Bible image first.",422);
        const {data:existing}=await admin.from("cot_daily_visuals").select("storage_path,image_source").eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind","quote").maybeSingle();
        const {data,error}=await admin.from("cot_daily_visuals").upsert({
          organization_id:organizationId,
          visual_date:date,
          content_kind:"quote",
          image_url:bibleVisual.image_url,
          storage_path:null,
          image_source:"inherited",
          provider_code:bibleVisual.provider_code??null,
          prompt:"",
          status:"ready",
          last_error:"",
          generated_at:bibleVisual.generated_at??null,
          created_by:auth.user.id,
          updated_at:new Date().toISOString(),
        },{onConflict:"organization_id,visual_date,content_kind"}).select("*").single();
        if(error) throw new ApiError("DAILY_VISUAL_SAVE_FAILED","Unable to inherit the Daily Bible image.",500,undefined,false);
        if(existing?.storage_path&&existing.image_source!=="inherited") await admin.storage.from(DAILY_VISUAL_BUCKET).remove([existing.storage_path]).catch(()=>{});
        return {data};
      }

      if(actionName==="visual_clear"){
        const {data:existing}=await admin.from("cot_daily_visuals").select("storage_path,image_source").eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind).maybeSingle();
        const {error}=await admin.from("cot_daily_visuals").delete().eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind);
        if(error) throw new ApiError("DAILY_VISUAL_DELETE_FAILED","Unable to remove this Daily visual.",500,undefined,false);
        if(existing?.storage_path&&existing.image_source!=="inherited") await admin.storage.from(DAILY_VISUAL_BUCKET).remove([existing.storage_path]).catch(()=>{});
        return {data:{date,kind,deleted:true}};
      }

      const seriesId=kind==="devotional"?optionalUuid(body.seriesId,"seriesId"):null;
      const content=await visualContent(admin,organizationId,date,kind,seriesId);
      const style=imageStyle(body.style);
      const mood=imageMood(body.mood);
      const direction=text(body.direction??"",1200);
      const scene=await generateVisualScene(admin,{
        useCase:"daily_"+kind,
        source:dailyVisualSceneSource(kind,content,direction),
        style,
        mood,
      },request.signal);
      const prompt=visualPrompt(kind,scene,style,mood);
      const {data:existing}=await admin.from("cot_daily_visuals").select("storage_path,image_source").eq("organization_id",organizationId).eq("visual_date",date).eq("content_kind",kind).maybeSingle();
      await admin.from("cot_daily_visuals").upsert({
        organization_id:organizationId,
        visual_date:date,
        content_kind:kind,
        image_url:null,
        storage_path:null,
        image_source:"ai",
        provider_code:null,
        prompt,
        status:"generating",
        last_error:"",
        generated_at:null,
        created_by:auth.user.id,
        updated_at:new Date().toISOString(),
      },{onConflict:"organization_id,visual_date,content_kind"});
      try{
        const generated=await generateImage(admin,prompt,request.signal);
        const ext=visualExtension(generated.contentType);
        const storagePath="orgs/"+organizationId+"/"+kind+"/"+date+"/ai-"+crypto.randomUUID()+"."+ext;
        const {error:uploadError}=await admin.storage.from(DAILY_VISUAL_BUCKET).upload(storagePath,generated.bytes,{contentType:generated.contentType,upsert:false});
        if(uploadError) throw new ApiError("DAILY_VISUAL_STORAGE_FAILED","The image was generated but could not be stored.",500,undefined,false);
        const imageUrl=admin.storage.from(DAILY_VISUAL_BUCKET).getPublicUrl(storagePath).data.publicUrl;
        const {data,error}=await admin.from("cot_daily_visuals").upsert({
          organization_id:organizationId,
          visual_date:date,
          content_kind:kind,
          image_url:imageUrl,
          storage_path:storagePath,
          image_source:"ai",
          provider_code:generated.providerCode,
          prompt,
          status:"ready",
          last_error:"",
          generated_at:new Date().toISOString(),
          created_by:auth.user.id,
          updated_at:new Date().toISOString(),
        },{onConflict:"organization_id,visual_date,content_kind"}).select("*").single();
        if(error) throw new ApiError("DAILY_VISUAL_SAVE_FAILED","The generated image could not be attached.",500,undefined,false);
        if(existing?.storage_path&&existing.storage_path!==storagePath&&existing.image_source!=="inherited") await admin.storage.from(DAILY_VISUAL_BUCKET).remove([existing.storage_path]).catch(()=>{});
        return {data:{...data,model:generated.model}};
      }catch(value){
        const message=value instanceof Error?value.message:"Image generation failed.";
        await admin.from("cot_daily_visuals").upsert({
          organization_id:organizationId,
          visual_date:date,
          content_kind:kind,
          image_url:null,
          storage_path:null,
          image_source:"ai",
          provider_code:null,
          prompt,
          status:"failed",
          last_error:message.slice(0,1000),
          generated_at:null,
          created_by:auth.user.id,
          updated_at:new Date().toISOString(),
        },{onConflict:"organization_id,visual_date,content_kind"});
        throw value;
      }
    }

    if(["quote_save","quote_delete","quote_provision"].includes(actionName)){
      await requireDailyHighlightsManager(auth,organizationId);

      if(actionName==="quote_save"){
        const date=quoteDate(body.date);
        const status=text(body.status??"published",20,true);
        if(!DAILY_QUOTE_STATUSES.has(status)) throw new ApiError("VALIDATION_FAILED","Invalid Daily Quote status.",422);
        const record={
          organization_id:organizationId,
          quote_date:date,
          body:text(body.body,500,true),
          source_reference:text(body.sourceReference??"",120),
          theme:text(body.theme??"general",80)||"general",
          source:"ministry",
          status,
          created_by:auth.user.id,
          updated_at:new Date().toISOString(),
        };
        const {data,error}=await admin.from("cot_daily_quotes").upsert(record,{onConflict:"organization_id,quote_date"}).select().single();
        if(error) throw new ApiError("DAILY_QUOTE_SAVE_FAILED","Unable to save Daily Quote.",500,undefined,false);
        return {data};
      }

      if(actionName==="quote_delete"){
        const date=quoteDate(body.date);
        const {error}=await admin.from("cot_daily_quotes").delete().eq("organization_id",organizationId).eq("quote_date",date);
        if(error) throw new ApiError("DAILY_QUOTE_DELETE_FAILED","Unable to return this day to automatic Daily Quote.",500,undefined,false);
        return {data:{date,automatic:true}};
      }

      const fromDate=quoteDate(body.fromDate??new Date().toISOString().slice(0,10),"fromDate");
      const dayCount=Math.max(1,Math.min(30,Number(body.days??30)||30));
      const dates=Array.from({length:dayCount},(_,index)=>plusDays(fromDate,index));
      const {data:existing}=await admin.from("cot_daily_quotes").select("quote_date,source").eq("organization_id",organizationId).gte("quote_date",dates[0]).lte("quote_date",dates[dates.length-1]);
      const existingMap=new Map((existing??[]).map((row:any)=>[row.quote_date,row.source]));
      const overwriteProvisioned=body.overwriteProvisioned===true;
      const generated=await Promise.all(dates.map(async(date)=>{
        const existingSource=existingMap.get(date);
        if(existingSource==="ministry") return null;
        if(existingSource==="provisioned"&&!overwriteProvisioned) return null;
        const bible=await resolvedScripture(admin,organizationId,date);
        const quote=automaticQuote(bible,date);
        return {
          organization_id:organizationId,
          quote_date:date,
          body:quote.body,
          source_reference:quote.sourceReference,
          theme:quote.theme,
          source:"provisioned",
          status:"published",
          created_by:auth.user.id,
          updated_at:new Date().toISOString(),
        };
      }));
      const rows=generated.filter(Boolean);
      if(rows.length){
        const {error}=await admin.from("cot_daily_quotes").upsert(rows,{onConflict:"organization_id,quote_date"});
        if(error) throw new ApiError("DAILY_QUOTE_PROVISION_FAILED","Unable to provision Daily Quotes.",500,undefined,false);
      }
      return {data:{fromDate,days:dayCount,provisioned:rows.length,preserved:dayCount-rows.length}};
    }

    await requireManager(auth,organizationId);

    if(actionName==="create_banner_upload"){
      const mimeType=text(body.mimeType,80,true).toLowerCase();
      const ext=mimeType==="image/png"?"png":mimeType==="image/webp"?"webp":mimeType==="image/jpeg"?"jpg":null;
      if(!ext) throw new ApiError("UNSUPPORTED_MEDIA_TYPE","Choose a JPG, PNG, or WebP banner.",415);
      const path="orgs/"+organizationId+"/"+auth.user.id+"/"+crypto.randomUUID()+"."+ext;
      const {data,error}=await admin.storage.from(BANNER_BUCKET).createSignedUploadUrl(path,{upsert:false});
      if(error||!data?.signedUrl) throw new ApiError("UPLOAD_SESSION_FAILED","Unable to prepare banner upload.",500,undefined,false);
      return {data:{signedUploadUrl:data.signedUrl,publicUrl:admin.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl}};
    }

    if(actionName==="banner_save"){
      const id=optionalUuid(body.id,"id");
      const status=text(body.status??"draft",20,true);
      if(!BANNER_STATUSES.has(status)) throw new ApiError("VALIDATION_FAILED","Invalid banner status.",422);
      const destinationType=text(body.destinationType??"none",30,true);
      if(!BANNER_DESTINATIONS.has(destinationType)) throw new ApiError("VALIDATION_FAILED","Invalid banner destination.",422);
      const destinationValue=text(body.destinationValue??"",2000);
      if(destinationType==="route"&&destinationValue&&!destinationValue.startsWith("/")) throw new ApiError("VALIDATION_FAILED","Internal routes must begin with /.",422);
      if(destinationType==="external"&&destinationValue&&!/^https?:\/\//i.test(destinationValue)) throw new ApiError("VALIDATION_FAILED","External links must start with http:// or https://.",422);
      const record={
        organization_id:organizationId,
        title:text(body.title,180,true),
        subtitle:text(body.subtitle??"",500),
        image_url:text(body.imageUrl??"",2000)||null,
        destination_type:destinationType,
        destination_value:destinationValue||null,
        status,
        priority:Math.max(-1000,Math.min(1000,Number(body.priority??0)||0)),
        starts_at:iso(body.startsAt,"startsAt"),
        ends_at:iso(body.endsAt,"endsAt"),
        updated_at:new Date().toISOString(),
      };
      if(record.starts_at&&record.ends_at&&Date.parse(record.ends_at)<=Date.parse(record.starts_at)) throw new ApiError("VALIDATION_FAILED","Banner end time must be after its start time.",422);
      if(id){
        const {data,error}=await admin.from("cot_home_banners").update(record).eq("id",id).eq("organization_id",organizationId).select().single();
        if(error) throw new ApiError("BANNER_SAVE_FAILED","Unable to update banner.",500,undefined,false);
        return {data};
      }
      const {data,error}=await admin.from("cot_home_banners").insert({...record,created_by:auth.user.id}).select().single();
      if(error) throw new ApiError("BANNER_SAVE_FAILED","Unable to create banner.",500,undefined,false);
      return {data,status:201};
    }

    if(actionName==="banner_delete"){
      const id=uuid(requiredString(body.id,"id",36),"id",true)!;
      const {error}=await admin.from("cot_home_banners").delete().eq("id",id).eq("organization_id",organizationId);
      if(error) throw new ApiError("BANNER_DELETE_FAILED","Unable to delete banner.",500,undefined,false);
      return {data:{id,deleted:true}};
    }

    if(actionName==="form_save"){
      const id=optionalUuid(body.id,"id");
      const status=text(body.status??"draft",20,true);
      if(!FORM_STATUSES.has(status)) throw new ApiError("VALIDATION_FAILED","Invalid form status.",422);
      const record={
        organization_id:organizationId,
        slug:slugify(body.slug??body.title),
        title:text(body.title,180,true),
        description:text(body.description??"",2000),
        status,
        fields:normalizeFields(body.fields),
        submit_label:text(body.submitLabel??"Submit",80,true),
        success_message:text(body.successMessage??"Thank you. Your response has been received.",500,true),
        requires_auth:body.requiresAuth!==false,
        banner_image_url:text(body.bannerImageUrl??"",2000)||null,
        updated_at:new Date().toISOString(),
      };
      if(id){
        const {data,error}=await admin.from("cot_forms").update(record).eq("id",id).eq("organization_id",organizationId).select().single();
        if(error?.code==="23505") throw new ApiError("FORM_SLUG_TAKEN","Use a different form slug.",409);
        if(error) throw new ApiError("FORM_SAVE_FAILED","Unable to update form.",500,undefined,false);
        return {data};
      }
      const {data,error}=await admin.from("cot_forms").insert({...record,created_by:auth.user.id}).select().single();
      if(error?.code==="23505") throw new ApiError("FORM_SLUG_TAKEN","Use a different form slug.",409);
      if(error) throw new ApiError("FORM_SAVE_FAILED","Unable to create form.",500,undefined,false);
      return {data,status:201};
    }

    if(actionName==="form_delete"){
      const id=uuid(requiredString(body.id,"id",36),"id",true)!;
      const {error}=await admin.from("cot_forms").delete().eq("id",id).eq("organization_id",organizationId);
      if(error) throw new ApiError("FORM_DELETE_FAILED","Unable to delete form.",500,undefined,false);
      return {data:{id,deleted:true}};
    }

    if(actionName==="submission_status"){
      const id=uuid(requiredString(body.id,"id",36),"id",true)!;
      const status=text(body.status,20,true);
      if(!["active","hidden"].includes(status)) throw new ApiError("VALIDATION_FAILED","Invalid response status.",422);
      const {data,error}=await admin.from("cot_form_submissions").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("organization_id",organizationId).select().single();
      if(error) throw new ApiError("FORM_RESPONSE_UPDATE_FAILED","Unable to update response.",500,undefined,false);
      return {data};
    }

    if(actionName==="submission_delete"){
      const id=uuid(requiredString(body.id,"id",36),"id",true)!;
      const {error}=await admin.from("cot_form_submissions").delete().eq("id",id).eq("organization_id",organizationId);
      if(error) throw new ApiError("FORM_RESPONSE_DELETE_FAILED","Unable to delete response.",500,undefined,false);
      return {data:{id,deleted:true}};
    }

    throw new ApiError("NOT_FOUND","Engagement action not recognized.",404);
  }
);

if (import.meta.main) Deno.serve(engagementHubHandler);
