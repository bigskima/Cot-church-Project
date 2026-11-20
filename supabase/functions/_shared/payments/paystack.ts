import { ApiError } from '../errors.ts';
import { resolveSecretValue } from '../secrets.ts';
import type { PaymentCheckoutRequest, PaymentCheckoutResult, PaymentProviderAdapter, PaymentProviderConfiguration, VerifiedPaymentEvent } from './types.ts';

const API='https://api.paystack.co';

async function paystackRequest<T>(config:PaymentProviderConfiguration,path:string,init:RequestInit={},signal?:AbortSignal){
  const secret=await resolveSecretValue(config.secretReference);
  const response=await fetch(`${API}${path}`,{...init,signal,headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json',...init.headers}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.status===false)throw new ApiError('PAYSTACK_ERROR',payload.message??`Paystack returned ${response.status}`,502,undefined,false);
  return payload.data as T;
}

function channelFor(method:string){return({cards:'card',card:'card',bank_transfer:'bank_transfer',ussd:'ussd',mobile_money:'mobile_money',bank:'bank'} as Record<string,string>)[method];}
function statusOf(value:string):VerifiedPaymentEvent['status']{return value==='success'?'succeeded':value==='failed'?'failed':value==='abandoned'?'cancelled':value==='ongoing'||value==='pending'||value==='processing'?'processing':'requires_action';}
async function sha512(secret:string,value:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);return[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function constantTime(left:string,right:string){if(left.length!==right.length)return false;let result=0;for(let i=0;i<left.length;i++)result|=left.charCodeAt(i)^right.charCodeAt(i);return result===0;}

export class PaystackPaymentProvider implements PaymentProviderAdapter{
  readonly code='paystack';

  async initialize(config:PaymentProviderConfiguration,request:PaymentCheckoutRequest,signal:AbortSignal):Promise<PaymentCheckoutResult>{
    const reference=`COT-${request.attemptId}`;
    const channel=channelFor(request.paymentMethod);
    const settings=config.settings??{};
    const payload:any={email:request.email,amount:String(request.amountMinor),currency:request.currency,reference,metadata:JSON.stringify({...request.metadata,attemptId:request.attemptId,donationId:request.donationId})};
    if(channel)payload.channels=[channel];
    if(typeof settings.callbackUrl==='string'&&settings.callbackUrl)payload.callback_url=settings.callbackUrl;
    const data=await paystackRequest<{authorization_url:string;access_code:string;reference:string}>(config,'/transaction/initialize',{method:'POST',body:JSON.stringify(payload)},signal);
    return{providerPaymentId:data.reference,status:'requires_action',checkoutUrl:data.authorization_url,accessCode:data.access_code,rawMetadata:{reference:data.reference}};
  }

  async verifyWebhook(config:PaymentProviderConfiguration,rawBody:string,headers:Headers):Promise<VerifiedPaymentEvent>{
    // Paystack signs webhook payloads with the integration secret key. A separate
    // webhook reference is allowed by the platform, but it should resolve to that same key.
    const secret=await resolveSecretValue(config.webhookSecretReference||config.secretReference);
    const supplied=(headers.get('x-paystack-signature')??'').trim().toLowerCase();
    const expected=await sha512(secret,rawBody);
    if(!supplied||!constantTime(expected,supplied))throw new ApiError('PAYMENT_WEBHOOK_SIGNATURE_INVALID','Paystack webhook signature is invalid',401);
    const event=JSON.parse(rawBody) as any;
    const data=event.data??{};
    const metadata=typeof data.metadata==='string'?(()=>{try{return JSON.parse(data.metadata)}catch{return{}}})():data.metadata??{};
    return{eventId:String(data.id??`${event.event}:${data.reference??crypto.randomUUID()}`),eventType:String(event.event??'unknown'),providerPaymentId:data.reference?String(data.reference):undefined,attemptId:metadata.attemptId?String(metadata.attemptId):undefined,status:event.event==='charge.success'?'succeeded':event.event==='charge.failed'?'failed':statusOf(String(data.status??'')),amountMinor:Number.isFinite(Number(data.amount))?Number(data.amount):undefined,currency:data.currency?String(data.currency).toUpperCase():undefined,raw:event};
  }

  async verifyPayment(config:PaymentProviderConfiguration,providerPaymentId:string,signal:AbortSignal):Promise<VerifiedPaymentEvent>{
    const data=await paystackRequest<any>(config,`/transaction/verify/${encodeURIComponent(providerPaymentId)}`,{},signal);
    const metadata=typeof data.metadata==='string'?(()=>{try{return JSON.parse(data.metadata)}catch{return{}}})():data.metadata??{};
    return{eventId:`verify:${String(data.id??providerPaymentId)}:${String(data.status??'unknown')}`,eventType:'transaction.verify',providerPaymentId:String(data.reference??providerPaymentId),attemptId:metadata.attemptId?String(metadata.attemptId):undefined,status:statusOf(String(data.status??'')),amountMinor:Number.isFinite(Number(data.amount))?Number(data.amount):undefined,currency:data.currency?String(data.currency).toUpperCase():undefined,raw:data};
  }

  async refund(config:PaymentProviderConfiguration,providerPaymentId:string,amountMinor:number,signal:AbortSignal){
    const data=await paystackRequest<any>(config,'/refund',{method:'POST',body:JSON.stringify({transaction:providerPaymentId,amount:amountMinor})},signal);
    return{providerRefundId:String(data.id??data.transaction?.reference??providerPaymentId),status:String(data.status??'pending')};
  }
}
