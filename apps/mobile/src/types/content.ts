export type MediaAsset = { type: 'image' | 'video'; url: string; thumbnailUrl?: string; alt?: string };
export type SocialPost = { id:string; body:string; visibility:'public'|'organization'|'branch'|'group'|'private'; media:MediaAsset[]; published_at:string; social_reactions?:{reaction:string}[] };
export type LiveStream = { id:string; title:string; description:string; status:'scheduled'|'live'|'ended'; visibility:'public'|'organization'|'branch'|'group'|'private'; scheduled_start?:string; started_at?:string; thumbnail_url?:string; playback_url?:string; viewer_count?:number };
export type Event = { id:string; title:string; description:string; starts_at:string; ends_at:string; location?:{name?:string}; visibility:string };
export type MembershipContext = { profile:{id:string;display_name:string;avatar_url?:string}; organizations:{id:string;name:string;slug:string;memberships:{id:string;status:string;branch_id?:string}[]}[] };
