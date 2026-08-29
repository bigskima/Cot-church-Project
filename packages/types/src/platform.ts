export type ContentVisibility="public"|"organization"|"branch"|"group"|"private";
export type StreamStatus="draft"|"scheduled"|"live"|"ended"|"cancelled"|"archived";
export interface LiveStream{id:string;branch_id:string|null;event_id:string|null;title:string;description:string;status:StreamStatus;visibility:ContentVisibility;provider:string;playback_url:string|null;scheduled_start:string|null;started_at:string|null;ended_at:string|null;recording_url:string|null;}
export interface SocialPost{id:string;author_membership_id:string;branch_id:string|null;group_id:string|null;visibility:ContentVisibility;status:"draft"|"published"|"hidden"|"archived";body:string;media:Array<Record<string,unknown>>;published_at:string;}
export interface SocialComment{id:string;post_id:string;author_membership_id:string;parent_comment_id:string|null;body:string;created_at:string;}
export interface OrganizationDashboard{members:number;events:number;attendance:number;giving:Record<string,number>;engagement:{posts:number;reactions:number};}
export interface IntegrationConnection{id:string;provider:string;name:string;status:"active"|"disabled"|"error";configuration:Record<string,unknown>;last_success_at:string|null;last_error_at:string|null;}
export interface WorkflowRun{id:string;workflow_definition_id:string;status:"queued"|"running"|"succeeded"|"failed"|"cancelled"|"dead_letter";state:Record<string,unknown>;attempts:number;available_at:string;}
