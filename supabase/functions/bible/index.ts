import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { resolveActiveOrganizationId } from "../_shared/public-organization.ts";
import { assertFeatureEnabled } from "../_shared/feature-controls.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const GETBIBLE_BASE = "https://api.getbible.net/v3";
const YOUVERSION_BASE = "https://api.youversion.com/v1";
const BIBLE_BRAIN_BASE = "https://4.dbt.io/api";

const BOOKS = [
 ["Genesis","GEN",1,50],["Exodus","EXO",2,40],["Leviticus","LEV",3,27],["Numbers","NUM",4,36],["Deuteronomy","DEU",5,34],
 ["Joshua","JOS",6,24],["Judges","JDG",7,21],["Ruth","RUT",8,4],["1 Samuel","1SA",9,31],["2 Samuel","2SA",10,24],
 ["1 Kings","1KI",11,22],["2 Kings","2KI",12,25],["1 Chronicles","1CH",13,29],["2 Chronicles","2CH",14,36],["Ezra","EZR",15,10],
 ["Nehemiah","NEH",16,13],["Esther","EST",17,10],["Job","JOB",18,42],["Psalms","PSA",19,150],["Proverbs","PRO",20,31],
 ["Ecclesiastes","ECC",21,12],["Song of Solomon","SNG",22,8],["Isaiah","ISA",23,66],["Jeremiah","JER",24,52],["Lamentations","LAM",25,5],
 ["Ezekiel","EZK",26,48],["Daniel","DAN",27,12],["Hosea","HOS",28,14],["Joel","JOL",29,3],["Amos","AMO",30,9],
 ["Obadiah","OBA",31,1],["Jonah","JON",32,4],["Micah","MIC",33,7],["Nahum","NAM",34,3],["Habakkuk","HAB",35,3],
 ["Zephaniah","ZEP",36,3],["Haggai","HAG",37,2],["Zechariah","ZEC",38,14],["Malachi","MAL",39,4],["Matthew","MAT",40,28],
 ["Mark","MRK",41,16],["Luke","LUK",42,24],["John","JHN",43,21],["Acts","ACT",44,28],["Romans","ROM",45,16],
 ["1 Corinthians","1CO",46,16],["2 Corinthians","2CO",47,13],["Galatians","GAL",48,6],["Ephesians","EPH",49,6],["Philippians","PHP",50,4],
 ["Colossians","COL",51,4],["1 Thessalonians","1TH",52,5],["2 Thessalonians","2TH",53,3],["1 Timothy","1TI",54,6],["2 Timothy","2TI",55,4],
 ["Titus","TIT",56,3],["Philemon","PHM",57,1],["Hebrews","HEB",58,13],["James","JAS",59,5],["1 Peter","1PE",60,5],
 ["2 Peter","2PE",61,3],["1 John","1JN",62,5],["2 John","2JN",63,1],["3 John","3JN",64,1],["Jude","JUD",65,1],["Revelation","REV",66,22],
] as const;

const ALIASES: Record<string,string> = {
  psalm:"Psalms", psalms:"Psalms", ps:"Psalms", song:"Song of Solomon", "song of songs":"Song of Solomon",
  "canticles":"Song of Solomon", jn:"John", joh:"John", mk:"Mark", mrk:"Mark", mt:"Matthew", matt:"Matthew",
  lk:"Luke", rom:"Romans", rev:"Revelation", eph:"Ephesians", phil:"Philippians", col:"Colossians",
  gen:"Genesis", ex:"Exodus", exo:"Exodus", lev:"Leviticus", num:"Numbers", deut:"Deuteronomy",
};

type ParsedReference = { display:string; bookName:string; usfm:string; bookNumber:number; chapter:number; verseStart?:number; verseEnd?:number };

function cleanText(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeBook(value: string) {
  const key = value.toLowerCase().replace(/\./g,"").replace(/\s+/g," ").trim();
  const aliased = ALIASES[key] ?? value.trim();
  const found = BOOKS.find(([name,usfm]) => name.toLowerCase() === aliased.toLowerCase() || usfm.toLowerCase() === key);
  return found ?? null;
}

function parseReference(input: string): ParsedReference {
  const raw = input.trim().replace(/[–—]/g,"-").replace(/\s+/g," ");
  const match = raw.match(/^((?:[1-3]\s*)?[A-Za-z]+(?:\s+of\s+[A-Za-z]+|\s+[A-Za-z]+)*)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/i);
  if (!match) throw new ApiError("BIBLE_REFERENCE_INVALID","Enter a Bible reference such as John 3:16 or Psalm 23.",422);
  const book = normalizeBook(match[1]);
  if (!book) throw new ApiError("BIBLE_BOOK_INVALID","Bible book not recognized.",422);
  const chapter = Number(match[2]);
  const verseStart = match[3] ? Number(match[3]) : undefined;
  const verseEnd = match[4] ? Number(match[4]) : verseStart;
  if (chapter < 1 || chapter > book[3]) throw new ApiError("BIBLE_CHAPTER_INVALID","Chapter is outside this book.",422);
  const suffix = verseStart ? `:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}` : "";
  return { display:`${book[0]} ${chapter}${suffix}`, bookName:book[0], usfm:book[1], bookNumber:book[2], chapter, verseStart, verseEnd };
}

function usfmReference(parsed: ParsedReference) {
  if (!parsed.verseStart) return `${parsed.usfm}.${parsed.chapter}`;
  return `${parsed.usfm}.${parsed.chapter}.${parsed.verseStart}${parsed.verseEnd && parsed.verseEnd !== parsed.verseStart ? `-${parsed.verseEnd}` : ""}`;
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new ApiError("BIBLE_PROVIDER_FAILED",`Bible provider returned ${response.status}`,502,undefined,false);
  return response.json();
}

let webFullBiblePromise: Promise<any> | null = null;
function webFullBible() {
  if (!webFullBiblePromise) {
    webFullBiblePromise = fetchJson(`${GETBIBLE_BASE}/web.json`).catch((error) => {
      webFullBiblePromise = null;
      throw error;
    });
  }
  return webFullBiblePromise;
}

async function getWebPassage(parsed: ParsedReference) {
  const admin = adminClient();
  const key = `web:${parsed.display.toLowerCase()}`;
  const { data: cached } = await admin.from("bible_public_passage_cache").select("payload").eq("cache_key",key).maybeSingle();
  if (cached?.payload) return cached.payload;

  const chapter = await fetchJson(`${GETBIBLE_BASE}/web/${parsed.bookNumber}/${parsed.chapter}.json`);
  const verses = (chapter?.verses ?? []).filter((verse: any) => {
    const nr = Number(verse.nr ?? verse.verse ?? verse.number);
    if (!parsed.verseStart) return true;
    return nr >= parsed.verseStart! && nr <= (parsed.verseEnd ?? parsed.verseStart!);
  }).map((verse:any) => ({
    bookId: parsed.usfm,
    bookName: parsed.bookName,
    chapter: parsed.chapter,
    verse: Number(verse.nr ?? verse.verse ?? verse.number),
    text: cleanText(verse.text),
  }));
  const payload = {
    reference: parsed.display,
    versionId: "web",
    abbreviation: "WEB",
    versionName: chapter?.translation || "World English Bible",
    language: chapter?.language || "English",
    copyright: "Public Domain",
    provider: "getbible",
    verses,
    text: verses.map((v:any) => v.text).join(" "),
    audio: null,
  };
  await admin.from("bible_public_passage_cache").upsert({ cache_key:key,version_id:"web",reference:parsed.display,payload }).then(()=>{});
  return payload;
}

function stripVerseLabel(value: string) {
  return value
    .replace(/<span[^>]*class=["'][^"']*\\byv-vlbl\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/span>/gi, " ")
    .replace(/&nbsp;/gi, " ");
}

function parseYouVersionVerses(html: string, parsed: ParsedReference) {
  const source = String(html || "");
  const marker = /<span[^>]*class=["'][^"']*\\byv-v\\b[^"']*["'][^>]*\\bv=["']?(\\d+)["']?[^>]*>/gi;
  const starts: Array<{ verse: number; start: number; bodyStart: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(source))) {
    starts.push({ verse: Number(match[1]), start: match.index, bodyStart: marker.lastIndex });
  }
  if (!starts.length) return [];
  return starts.map((item, index) => {
    const end = starts[index + 1]?.start ?? source.length;
    const segment = source.slice(item.bodyStart, end);
    return {
      bookId: parsed.usfm,
      bookName: parsed.bookName,
      chapter: parsed.chapter,
      verse: item.verse,
      text: cleanText(stripVerseLabel(segment)),
    };
  }).filter((item) => item.text);
}

async function getYouVersionMetadata(versionId: string, key: string) {
  try {
    const result = await fetchJson(
      `${YOUVERSION_BASE}/bibles/${encodeURIComponent(versionId)}`,
      { headers: { "X-YVP-App-Key": key, "Accept":"application/json" } },
    );
    return result?.data ?? result ?? null;
  } catch {
    return null;
  }
}

async function getYouVersionPassage(parsed: ParsedReference, versionId: string) {
  const key = Deno.env.get("BIBLE_YOUVERSION_APP_KEY");
  if (!key) throw new ApiError("BIBLE_VERSION_UNAVAILABLE","This licensed Bible provider has not been connected yet.",503);
  const result = await fetchJson(
    `${YOUVERSION_BASE}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(usfmReference(parsed))}`,
    { headers: { "X-YVP-App-Key": key, "Accept":"application/json" } },
  );
  const row = result?.data ?? result;
  const html = row?.content ?? row?.html ?? row?.text ?? "";
  const metadata = await getYouVersionMetadata(versionId, key);
  let verses = Array.isArray(row?.verses) ? row.verses : [];

  if (!verses.length && typeof html === "string" && html.includes("yv-v")) {
    verses = parseYouVersionVerses(html, parsed);
  }

  if (!verses.length && !parsed.verseStart) {
    try {
      const verseIndex = await fetchJson(
        `${YOUVERSION_BASE}/bibles/${encodeURIComponent(versionId)}/books/${parsed.usfm}/chapters/${parsed.chapter}/verses?page_size=99`,
        { headers: { "X-YVP-App-Key": key, "Accept":"application/json" } },
      );
      const indexed = Array.isArray(verseIndex?.data) ? verseIndex.data : [];
      const resolved = await Promise.all(indexed.map(async (verse: any) => {
        const verseNumber = Number(verse?.id ?? verse?.title ?? String(verse?.passage_id ?? "").split(".").pop());
        if (!Number.isFinite(verseNumber)) return null;
        try {
          const passageId = verse?.passage_id || `${parsed.usfm}.${parsed.chapter}.${verseNumber}`;
          const verseResult = await fetchJson(
            `${YOUVERSION_BASE}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(passageId)}`,
            { headers: { "X-YVP-App-Key": key, "Accept":"application/json" } },
          );
          const verseRow = verseResult?.data ?? verseResult;
          return {
            bookId: parsed.usfm,
            bookName: parsed.bookName,
            chapter: parsed.chapter,
            verse: verseNumber,
            text: cleanText(stripVerseLabel(verseRow?.content ?? verseRow?.text ?? "")),
          };
        } catch {
          return null;
        }
      }));
      verses = resolved.filter(Boolean);
    } catch {
      // Keep the full passage as a last-resort fallback.
    }
  }

  if (parsed.verseStart && verses.length) {
    verses = verses.filter((verse: any) =>
      Number(verse.verse) >= parsed.verseStart! &&
      Number(verse.verse) <= (parsed.verseEnd ?? parsed.verseStart!)
    );
  }

  const normalizedText = verses.length
    ? verses.map((verse: any) => verse.text).join(" ")
    : cleanText(html);

  return {
    reference: parsed.display,
    versionId,
    abbreviation: metadata?.localized_abbreviation ?? metadata?.abbreviation ?? row?.bible?.abbreviation ?? row?.version?.abbreviation ?? String(versionId),
    versionName: metadata?.localized_title ?? metadata?.title ?? row?.bible?.title ?? row?.version?.title ?? "Bible",
    language: metadata?.language_tag ?? row?.bible?.language?.name ?? null,
    copyright: metadata?.copyright ?? row?.copyright ?? row?.bible?.copyright ?? null,
    provider: "youversion",
    verses,
    html,
    text: normalizedText,
    youversionDeepLink: metadata?.youversion_deep_link ?? row?.youversion_deep_link ?? null,
    audio: null,
  };
}

async function passage(reference: string, versionId = "web") {
  const parsed = parseReference(reference);
  return versionId === "web" ? getWebPassage(parsed) : getYouVersionPassage(parsed,versionId);
}

async function versions(language = "en") {
  const free = [{
    id:"web", abbreviation:"WEB", title:"World English Bible", language:{ name:"English", iso_639_1:"en" },
    copyright:"Public Domain", provider:"getbible", available:true,
  }];
  const key = Deno.env.get("BIBLE_YOUVERSION_APP_KEY");
  if (!key) return free;
  try {
    const result = await fetchJson(
      `${YOUVERSION_BASE}/bibles?language_ranges[]=${encodeURIComponent(language || "en")}&page_size=99`,
      { headers:{ "X-YVP-App-Key":key,"Accept":"application/json" } },
    );
    return [...free, ...(result?.data ?? []).map((item:any)=>({ ...item, id:String(item.id), provider:"youversion", available:true }))];
  } catch {
    return free;
  }
}

function flattenWebBible(data:any) {
  const out:any[] = [];
  for (const book of data?.books ?? []) {
    for (const chapter of book?.chapters ?? []) {
      for (const verse of chapter?.verses ?? []) {
        out.push({
          reference:`${book.name} ${chapter.chapter ?? chapter.nr ?? chapter.number}:${verse.nr ?? verse.verse ?? verse.number}`,
          book:book.name,
          chapter:Number(chapter.chapter ?? chapter.nr ?? chapter.number),
          verse:Number(verse.nr ?? verse.verse ?? verse.number),
          text:cleanText(verse.text),
        });
      }
    }
  }
  return out;
}

async function searchBible(query:string, versionId:string) {
  const trimmed=query.trim();
  if (!trimmed) return { verses:[],topics:[],query:trimmed };
  try {
    const parsed=parseReference(trimmed);
    const data=await passage(parsed.display,versionId);
    return { verses:(data.verses ?? []).map((v:any)=>({ reference:`${v.bookName ?? parsed.bookName} ${v.chapter ?? parsed.chapter}:${v.verse}`, text:v.text })),topics:[],query:trimmed };
  } catch { /* text/topic search */ }

  const admin=adminClient();
  const { data: topicRows }=await admin.from("bible_daily_pool").select("reference,theme").eq("active",true).ilike("theme",`%${trimmed}%`).limit(12);
  const topics=(topicRows ?? []).map((row:any)=>({ text:row.theme,reference:row.reference }));

  // Keyword search uses the public-domain WEB corpus as COT's stable search
  // index. Opening a result still uses the member's selected translation, so
  // licensed providers never need their full corpus copied into COT.


  const data=await webFullBible();
  const needle=trimmed.toLowerCase();
  const matches=flattenWebBible(data)
    .filter((row:any)=>row.text.toLowerCase().includes(needle))
    .slice(0,40);
  return { verses:matches,topics,query:trimmed,provider:"getbible" };
}

async function resolveOrganization(auth:any,url:URL,required=false) {
  const requested=url.searchParams.get("organizationId") ?? auth?.organizationId ?? null;
  try { return await resolveActiveOrganizationId(adminClient(),requested); }
  catch(error) { if(required) throw error; return null; }
}

async function requireBibleManager(auth:any,organizationId:string) {
  if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED","Sign in to manage Bible content.",401);
  const { data }=await auth.client.rpc("has_permission",{ target_organization_id:organizationId, requested_permission:"bible.manage", target_branch_id:null });
  if (!data) throw new ApiError("PERMISSION_DENIED","Bible management is not available for your ministry role.",403);
}

async function providerAudio(reference:string,organizationId:string) {
  const parsed=parseReference(reference);
  const key=Deno.env.get("BIBLE_BRAIN_API_KEY");
  const admin=adminClient();
  const { data: settings }=await admin.from("bible_provider_settings").select("configuration,enabled").eq("organization_id",organizationId).eq("provider_key","bible_brain").maybeSingle();
  if (!key || !settings?.enabled) return { available:false, provider:"tts", reason:"Bible Brain is not connected; use COT read aloud." };
  const config=settings.configuration ?? {};
  const fileset=String(config.audioFilesetId ?? "").trim();
  if (!fileset) return { available:false, provider:"tts", reason:"No Bible Brain audio fileset is configured." };
  const url=`${BIBLE_BRAIN_BASE}/bibles/filesets/${encodeURIComponent(fileset)}/${parsed.usfm}/${parsed.chapter}?v=4&key=${encodeURIComponent(key)}`;
  try {
    const result=await fetchJson(url);
    const rows=result?.data ?? [];
    const audio=(Array.isArray(rows)?rows:[]).find((row:any)=>row.path || row.url);
    return audio ? { available:true,provider:"bible_brain",url:audio.path ?? audio.url,duration:audio.duration ?? null,filesetId:fileset } : { available:false,provider:"tts" };
  } catch {
    return { available:false,provider:"tts",reason:"Recorded audio is unavailable for this chapter." };
  }
}

export const bibleHandler = createHandler(
  { methods:["GET","POST"], authentication:"optional", organization:"optional" },
  async ({ request,auth }) => {
    const url=new URL(request.url);
    const action=url.searchParams.get("action") ?? "home";
    const organizationId=await resolveOrganization(auth,url,request.method==="POST");

    if (request.method==="GET") {
      if (organizationId) await assertFeatureEnabled(adminClient(),"bible",{organizationId},"Bible is currently unavailable.");

      if (action==="books") return { data:BOOKS.map(([name,usfm,number,chapters])=>({name,usfm,number,chapters})) };
      if (action==="versions") return { data:await versions(url.searchParams.get("language") ?? "en") };
      if (action==="passage" || action==="preview") {
        const reference=requiredString(url.searchParams.get("reference"),"reference",80);
        const versionId=url.searchParams.get("versionId") ?? "web";
        const data=await passage(reference,versionId);
        if (organizationId && action==="passage") data.audio=await providerAudio(reference,organizationId);
        return { data };
      }
      if (action==="search") {
        const query=requiredString(url.searchParams.get("q"),"q",160);
        const versionId=url.searchParams.get("versionId") ?? "web";
        return { data:await searchBible(query,versionId) };
      }
      if (action==="today") {
        if (!organizationId) throw new ApiError("ORGANIZATION_REQUIRED","Choose a church to load Daily Scripture.",422);
        const date=url.searchParams.get("date") ?? new Date().toISOString().slice(0,10);
        const { data: rows,error }=await adminClient().rpc("resolve_daily_scripture",{target_organization_id:organizationId,target_date:date});
        if (error || !rows?.[0]) throw new ApiError("DAILY_SCRIPTURE_UNAVAILABLE","Daily Scripture is unavailable.",404);
        const selected=rows[0];
        return { data:{...selected,date,passage:await passage(selected.reference,selected.version_id ?? "web")} };
      }
      if (action==="provider-status") {
        const admin=adminClient();
        const configured=organizationId ? await admin.from("bible_provider_settings").select("provider_key,enabled,priority,configuration").eq("organization_id",organizationId) : {data:[]};
        return { data:{
          freeProvider:{ key:"getbible",ready:true,label:"Public-domain Bible (GetBible/WEB)" },
          youversion:{ ready:Boolean(Deno.env.get("BIBLE_YOUVERSION_APP_KEY")),secretName:"BIBLE_YOUVERSION_APP_KEY" },
          bibleBrain:{ ready:Boolean(Deno.env.get("BIBLE_BRAIN_API_KEY")),secretName:"BIBLE_BRAIN_API_KEY" },
          configured:configured.data ?? [],
        }};
      }
      if (action==="me") {
        if (!auth?.user || !organizationId) return { data:{preferences:null,bookmarks:[],highlights:[],notes:[],history:[]} };
        const [preferences,bookmarks,highlights,notes,history]=await Promise.all([
          auth.client.from("bible_user_preferences").select("*").eq("profile_id",auth.user.id).eq("organization_id",organizationId).maybeSingle(),
          auth.client.from("bible_bookmarks").select("*").eq("profile_id",auth.user.id).eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100),
          auth.client.from("bible_highlights").select("*").eq("profile_id",auth.user.id).eq("organization_id",organizationId).order("updated_at",{ascending:false}).limit(200),
          auth.client.from("bible_notes").select("*").eq("profile_id",auth.user.id).eq("organization_id",organizationId).order("updated_at",{ascending:false}).limit(100),
          auth.client.from("bible_reading_history").select("*").eq("profile_id",auth.user.id).eq("organization_id",organizationId).order("last_read_at",{ascending:false}).limit(30),
        ]);
        return { data:{preferences:preferences.data,bookmarks:bookmarks.data??[],highlights:highlights.data??[],notes:notes.data??[],history:history.data??[]} };
      }
      if (action==="plans") {
        const { data,error }=await adminClient().from("bible_reading_plans").select("id,slug,title,description,duration_days,organization_id").eq("is_public",true).or(organizationId?`organization_id.is.null,organization_id.eq.${organizationId}`:"organization_id.is.null").order("created_at");
        if(error) throw new ApiError("BIBLE_PLANS_FAILED","Unable to load reading plans.",500,undefined,false);
        return { data:data??[] };
      }
      if (action==="plan") {
        const planId=uuid(url.searchParams.get("planId"),"planId",true)!;
        const admin=adminClient();
        const [{data:plan,error},{data:days}]=await Promise.all([
          admin.from("bible_reading_plans").select("*").eq("id",planId).eq("is_public",true).single(),
          admin.from("bible_reading_plan_days").select("*").eq("plan_id",planId).order("day_number"),
        ]);
        if(error) throw new ApiError("BIBLE_PLAN_NOT_FOUND","Reading plan not found.",404);
        let progress=null;
        if(auth?.user) progress=(await auth.client.from("bible_reading_plan_progress").select("*").eq("profile_id",auth.user.id).eq("plan_id",planId).maybeSingle()).data;
        return { data:{...plan,days:(days??[]).map((day:any)=>({...day,references:day.scripture_references??[]})),progress} };
      }
      if (action==="manage") {
        if(!organizationId) throw new ApiError("ORGANIZATION_REQUIRED","Choose a church.",422);
        await requireBibleManager(auth,organizationId);
        const admin=adminClient();
        const [schedule,pool,plans]=await Promise.all([
          admin.from("bible_daily_schedule").select("*").eq("organization_id",organizationId).order("scripture_date",{ascending:true}).gte("scripture_date",new Date().toISOString().slice(0,10)).limit(90),
          admin.from("bible_daily_pool").select("*").or(`organization_id.is.null,organization_id.eq.${organizationId}`).order("theme"),
          admin.from("bible_reading_plans").select("*").or(`organization_id.is.null,organization_id.eq.${organizationId}`).order("created_at",{ascending:false}),
        ]);
        return { data:{schedule:schedule.data??[],pool:pool.data??[],plans:plans.data??[]} };
      }
      throw new ApiError("NOT_FOUND","Bible action not recognized.",404);
    }

    if (!auth?.user || !organizationId) throw new ApiError("AUTHENTICATION_REQUIRED","Sign in to continue.",401);
    const body=assertObject(await jsonBody(request));
    const actionName=requiredString(body.action,"action",50);
    await assertFeatureEnabled(adminClient(),"bible",{organizationId},"Bible is currently unavailable.");

    if(actionName==="preferences"){
      assertNoUnknownFields(body,["action","defaultVersionId","languageTag","dailyScriptureNotification","notificationTime","timezone","audioRate"]);
      const row={
        profile_id:auth.user.id,organization_id:organizationId,
        default_version_id:String(body.defaultVersionId ?? "web").slice(0,80),
        language_tag:String(body.languageTag ?? "en").slice(0,20),
        daily_scripture_notification:Boolean(body.dailyScriptureNotification),
        notification_time:String(body.notificationTime ?? "07:00"),
        timezone:String(body.timezone ?? "Africa/Lagos").slice(0,80),
        audio_rate:Math.max(.5,Math.min(2,Number(body.audioRate ?? 1))),
        updated_at:new Date().toISOString(),
      };
      const {data,error}=await auth.client.from("bible_user_preferences").upsert(row).select().single();
      if(error) throw new ApiError("BIBLE_PREFERENCES_FAILED","Unable to save Bible preferences.",500,undefined,false);
      return {data};
    }
    if(actionName==="toggle_bookmark"){
      const reference=requiredString(body.reference,"reference",80); const versionId=String(body.versionId ?? "web");
      const existing=await auth.client.from("bible_bookmarks").select("id").eq("profile_id",auth.user.id).eq("organization_id",organizationId).eq("reference",reference).eq("version_id",versionId).maybeSingle();
      if(existing.data){ await auth.client.from("bible_bookmarks").delete().eq("id",existing.data.id); return {data:{bookmarked:false}}; }
      const {data,error}=await auth.client.from("bible_bookmarks").insert({profile_id:auth.user.id,organization_id:organizationId,reference,version_id:versionId}).select().single();
      if(error) throw new ApiError("BIBLE_BOOKMARK_FAILED","Unable to save bookmark.",500,undefined,false);
      return {data:{bookmarked:true,item:data}};
    }
    if(actionName==="highlight"){
      const reference=requiredString(body.reference,"reference",80); const versionId=String(body.versionId ?? "web");
      const color=String(body.colorKey ?? "gold");
      if(body.remove===true){await auth.client.from("bible_highlights").delete().eq("profile_id",auth.user.id).eq("organization_id",organizationId).eq("reference",reference).eq("version_id",versionId);return {data:{highlighted:false}};}
      const {data,error}=await auth.client.from("bible_highlights").upsert({profile_id:auth.user.id,organization_id:organizationId,reference,version_id:versionId,color_key:color,updated_at:new Date().toISOString()}).select().single();
      if(error) throw new ApiError("BIBLE_HIGHLIGHT_FAILED","Unable to save highlight.",500,undefined,false); return {data};
    }
    if(actionName==="note"){
      const reference=requiredString(body.reference,"reference",80); const versionId=String(body.versionId ?? "web");
      const note=String(body.body ?? "").trim();
      if(!note){await auth.client.from("bible_notes").delete().eq("profile_id",auth.user.id).eq("organization_id",organizationId).eq("reference",reference).eq("version_id",versionId);return {data:{deleted:true}};}
      const {data,error}=await auth.client.from("bible_notes").upsert({profile_id:auth.user.id,organization_id:organizationId,reference,version_id:versionId,body:note,updated_at:new Date().toISOString()}).select().single();
      if(error) throw new ApiError("BIBLE_NOTE_FAILED","Unable to save Bible note.",500,undefined,false); return {data};
    }
    if(actionName==="history"){
      const reference=requiredString(body.reference,"reference",80); const versionId=String(body.versionId ?? "web");
      const existing=await auth.client.from("bible_reading_history").select("read_count").eq("profile_id",auth.user.id).eq("organization_id",organizationId).eq("reference",reference).eq("version_id",versionId).maybeSingle();
      await auth.client.from("bible_reading_history").upsert({profile_id:auth.user.id,organization_id:organizationId,reference,version_id:versionId,last_read_at:new Date().toISOString(),read_count:Number(existing.data?.read_count ?? 0)+1});
      return {data:{recorded:true}};
    }
    if(actionName==="plan_progress"){
      const planId=uuid(String(body.planId),"planId",true)!; const day=Math.max(1,Number(body.dayNumber ?? 1));
      const existing=await auth.client.from("bible_reading_plan_progress").select("*").eq("profile_id",auth.user.id).eq("plan_id",planId).maybeSingle();
      const completed=[...new Set([...(existing.data?.completed_days ?? []),day])].sort((a,b)=>a-b);
      const {data:plan}=await adminClient().from("bible_reading_plans").select("duration_days").eq("id",planId).single();
      const finished=Boolean(plan && completed.length>=plan.duration_days);
      const {data,error}=await auth.client.from("bible_reading_plan_progress").upsert({profile_id:auth.user.id,plan_id:planId,current_day:finished?plan!.duration_days:Math.min((plan?.duration_days??day+1),Math.max(day+1,existing.data?.current_day??1)),completed_days:completed,completed_at:finished?new Date().toISOString():null,updated_at:new Date().toISOString()}).select().single();
      if(error) throw new ApiError("BIBLE_PLAN_PROGRESS_FAILED","Unable to update reading plan.",500,undefined,false); return {data};
    }

    if(["manage_daily","manage_pool","manage_provider","manage_plan"].includes(actionName)){
      await requireBibleManager(auth,organizationId);
      const admin=adminClient();
      if(actionName==="manage_daily"){
        const date=requiredString(body.date,"date",10); const reference=requiredString(body.reference,"reference",80); parseReference(reference);
        const {data,error}=await admin.from("bible_daily_schedule").upsert({organization_id:organizationId,scripture_date:date,reference,version_id:String(body.versionId??"web"),theme:String(body.theme??"general").slice(0,80),source:"ministry",message:body.message?String(body.message).slice(0,280):null,created_by:auth.user.id,updated_at:new Date().toISOString()},{onConflict:"organization_id,scripture_date"}).select().single();
        if(error) throw new ApiError("DAILY_SCRIPTURE_SAVE_FAILED","Unable to schedule Daily Scripture.",500,undefined,false); return {data};
      }
      if(actionName==="manage_pool"){
        const reference=requiredString(body.reference,"reference",80); parseReference(reference);
        const {data,error}=await admin.from("bible_daily_pool").upsert({organization_id:organizationId,reference,theme:String(body.theme??"general").slice(0,80),weight:Math.max(1,Math.min(1000,Number(body.weight??100))),active:body.active!==false,created_by:auth.user.id},{onConflict:"organization_id,reference"}).select().single();
        if(error) throw new ApiError("BIBLE_POOL_SAVE_FAILED","Unable to update Scripture pool.",500,undefined,false); return {data};
      }
      if(actionName==="manage_provider"){
        const providerKey=requiredString(body.providerKey,"providerKey",40);
        if(!["web_public_domain","youversion","bible_brain"].includes(providerKey)) throw new ApiError("VALIDATION_FAILED","Unknown Bible provider.",422);
        const configuration=body.configuration && typeof body.configuration==="object" && !Array.isArray(body.configuration) ? body.configuration : {};
        const {data,error}=await admin.from("bible_provider_settings").upsert({organization_id:organizationId,provider_key:providerKey,enabled:body.enabled!==false,priority:Number(body.priority??100),configuration,updated_by:auth.user.id,updated_at:new Date().toISOString()},{onConflict:"organization_id,provider_key"}).select().single();
        if(error) throw new ApiError("BIBLE_PROVIDER_SAVE_FAILED","Unable to save Bible provider settings.",500,undefined,false); return {data};
      }
      if(actionName==="manage_plan"){
        const title=requiredString(body.title,"title",160); const slug=String(body.slug??title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).slice(0,100);
        const days=Array.isArray(body.days)?body.days:[];
        if(!days.length) throw new ApiError("VALIDATION_FAILED","Add at least one reading-plan day.",422);
        const {data:plan,error}=await admin.from("bible_reading_plans").upsert({organization_id:organizationId,slug,title,description:String(body.description??"").slice(0,1200),duration_days:days.length,is_public:body.isPublic!==false,created_by:auth.user.id},{onConflict:"organization_id,slug"}).select().single();
        if(error) throw new ApiError("BIBLE_PLAN_SAVE_FAILED","Unable to save reading plan.",500,undefined,false);
        await admin.from("bible_reading_plan_days").delete().eq("plan_id",plan.id);
        const rows=days.map((day:any,index:number)=>({plan_id:plan.id,day_number:index+1,title:String(day.title??`Day ${index+1}`).slice(0,160),scripture_references:Array.isArray(day.references)?day.references.map(String):[],reflection:day.reflection?String(day.reflection).slice(0,2000):null}));
        const insert=await admin.from("bible_reading_plan_days").insert(rows); if(insert.error) throw new ApiError("BIBLE_PLAN_DAYS_FAILED","Unable to save plan days.",500,undefined,false);
        return {data:{...plan,days:rows}};
      }
    }
    throw new ApiError("NOT_FOUND","Bible action not recognized.",404);
  },
);

if (import.meta.main) Deno.serve(bibleHandler);
