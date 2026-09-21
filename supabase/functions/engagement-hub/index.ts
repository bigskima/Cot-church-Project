import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { resolveActiveOrganizationId } from "../_shared/public-organization.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertObject, requiredString, uuid } from "../_shared/validation.ts";

const BANNER_BUCKET="home-banners";
const FIELD_TYPES=new Set(["text","textarea","email","phone","number","select","checkbox","date"]);
const BANNER_DESTINATIONS=new Set(["none","route","external","event","announcement","form"]);
const BANNER_STATUSES=new Set(["draft","published","hidden","archived"]);
const FORM_STATUSES=new Set(["draft","published","closed","hidden"]);

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
        const {data,error}=await admin.from("cot_home_banners")
          .select("id,title,subtitle,image_url,destination_type,destination_value,priority,starts_at,ends_at")
          .eq("organization_id",organizationId)
          .eq("status","published")
          .or("starts_at.is.null,starts_at.lte."+now)
          .or("ends_at.is.null,ends_at.gte."+now)
          .order("priority",{ascending:false})
          .order("created_at",{ascending:false})
          .limit(20);
        if(error) throw new ApiError("HOME_BANNERS_FAILED","Unable to load COT highlights.",500,undefined,false);
        return {data:{banners:data??[]}};
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
        let query=admin.from("cot_forms").select("id,organization_id,slug,title,description,status,fields,submit_label,success_message,requires_auth,created_at,updated_at").eq("organization_id",organizationId).order("updated_at",{ascending:false});
        if(!manager) query=query.eq("status","published");
        const {data,error}=await query.limit(100);
        if(error) throw new ApiError("FORMS_LOAD_FAILED","Unable to load forms.",500,undefined,false);
        return {data:data??[]};
      }

      if(action==="manage"){
        await requireManager(auth,organizationId);
        const [banners,forms]=await Promise.all([
          admin.from("cot_home_banners").select("*").eq("organization_id",organizationId).order("priority",{ascending:false}).order("updated_at",{ascending:false}),
          admin.from("cot_forms").select("*").eq("organization_id",organizationId).order("updated_at",{ascending:false}),
        ]);
        return {data:{banners:banners.data??[],forms:forms.data??[]}};
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
        const [{data:interests},{data:registrations}]=await Promise.all([
          admin.from("cot_event_interests").select("profile_id,created_at").eq("organization_id",organizationId).eq("event_id",eventId).order("created_at",{ascending:false}),
          admin.from("event_registrations").select("id,membership_id,status,registered_at").eq("organization_id",organizationId).eq("event_id",eventId).order("registered_at",{ascending:false}),
        ]);
        const membershipIds=(registrations??[]).map((row:any)=>row.membership_id).filter(Boolean);
        const {data:memberships}=membershipIds.length
          ? await admin.from("memberships").select("id,profile_id").in("id",membershipIds)
          : {data:[] as any[]};
        const memberMap=new Map((memberships??[]).map((row:any)=>[row.id,row.profile_id]));
        const ids=[
          ...(interests??[]).map((row:any)=>row.profile_id),
          ...(registrations??[]).map((row:any)=>memberMap.get(row.membership_id)).filter(Boolean),
        ];
        const profiles=await profileMap(admin,ids as string[]);
        return {data:{
          interested:(interests??[]).map((row:any)=>({...row,profile:profiles.get(row.profile_id)??null})),
          registered:(registrations??[]).map((row:any)=>({...row,profile:profiles.get(memberMap.get(row.membership_id))??null})),
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
