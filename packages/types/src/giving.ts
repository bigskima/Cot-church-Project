export type CampaignStatus="draft"|"active"|"paused"|"completed"|"archived";
export type DonationStatus="pending"|"succeeded"|"failed"|"refunded"|"partially_refunded"|"cancelled";
export type PaymentAttemptStatus="created"|"requires_action"|"processing"|"succeeded"|"failed"|"cancelled";
export interface GivingCampaign{id:string;branch_id:string|null;name:string;description:string;status:CampaignStatus;currency:string;goal_amount_minor:number|null;starts_at:string|null;ends_at:string|null;}
export interface Donation{id:string;branch_id:string|null;campaign_id:string|null;amount_minor:number;currency:string;status:DonationStatus;anonymous:boolean;succeeded_at:string|null;created_at:string;}
export interface DonationIntentRequest{branchId?:string;campaignId?:string;amountMinor:number;currency:string;provider:string;idempotencyKey:string;anonymous?:boolean;note?:string;}
export interface Receipt{id:string;donation_id:string;receipt_number:string;amount_minor:number;currency:string;issued_at:string;voided_at:string|null;snapshot:Record<string,unknown>;}
export interface GivingSummary{currency:string;donation_count:number;total_amount_minor:string;refunded_amount_minor:string;}
