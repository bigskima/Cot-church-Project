import { ApiError } from '../errors.ts';
import { resolveSecretValue } from '../secrets.ts';
import type { PaymentCheckoutRequest, PaymentCheckoutResult, PaymentProviderAdapter, PaymentProviderConfiguration, VerifiedPaymentEvent } from './types.ts';

const API='https://api.stripe.com/v1';

async function stripeRequest<T>(config:PaymentProviderConfiguration,path:string,init:RequestInit={},signal?:AbortSignal){
  const secret=await resolveSecretValue(config.secretReference);
  const response=await fetch(`${API}${path}`,{...init,signal,headers:{Authorization:`Bearer ${secret}`,...init.headers}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new ApiError('STRIPE_ERROR',payload.error?.message??`Stripe returned ${response.status}`,502,undefined,false);
  return payload as T;
}
function formBody(entries:Record<string,string|number|boolean|undefined>){const form=new URLSearchParams();for(const[key,value]of Object.entries(entries)){if(value!==undefined)form.set(key,String(value));}return form.toString();}
function statusOf(session:any):VerifiedPaymentEvent['status']{if(session.payment_status==='paid'||session.status==='complete')return'succeeded';if(session.status==='expired')return'cancelled';if(session.payment_status==='unpaid'&&session.status==='open')return'requires_action';return'processing';}
async function hmac256(secret:string,value:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function constantTime(left:string,right:string){if(left.length!==right.length)return false;let result=0;for(let i=0;i<left.length;i++)result|=left.charCodeAt(i)^right.charCodeAt(i);return result===0;}

export class StripePaymentProvider implements PaymentProviderAdapter{
  readonly code='stripe';

  async initialize(config:PaymentProviderConfiguration,request:PaymentCheckoutRequest,signal:AbortSignal):Promise<PaymentCheckoutResult>{
    const successUrl=typeof config.settings.successUrl==='string'?config.settings.successUrl:'';
    const cancelUrl=typeof config.settings.cancelUrl==='string'?config.settings.cancelUrl:'';
    if(!/^https:\/\//i.test(successUrl)||!/^https:\/\//i.test(cancelUrl))throw new ApiError('STRIPE_RETURN_URLS_REQUIRED','Stripe Checkout requires HTTPS success and cancel URLs in provider configuration',503,undefined,false);
    const body=formBody({
      mode:'payment',
      client_reference_id:request.attemptId,
      customer_email:request.email,
      success_url:successUrl,
      cancel_url:cancelUrl,
      'line_items[0][quantity]':1,
      'line_items[0][price_data][currency]':request.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]':request.amountMinor,
      'line_items[0][price_data][product_data][name]':request.description||'Church Giving',
      'metadata[attemptId]':request.attemptId,
      'metadata[donationId]':request.donationId,
      'payment_intent_data[metadata][attemptId]':request.attemptId,
      'payment_intent_data[metadata][donationId]':request.donationId,
    });
    const session=await stripeRequest<any>(config,'/checkout/sessions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body},signal);
    return{providerPaymentId:String(session.id),status:statusOf(session),checkoutUrl:session.url?String(session.url):undefined,expiresAt:session.expires_at?new Date(Number(session.expires_at)*1000).toISOString():undefined,rawMetadata:{paymentIntent:session.payment_intent??null}};
  }

  async verifyWebhook(config:PaymentProviderConfiguration,rawBody:string,headers:Headers):Promise<VerifiedPaymentEvent>{
    const secret=await resolveSecretValue(config.webhookSecretReference);
    const header=headers.get('stripe-signature')??'';
    const parts=header.split(',').map(part=>part.trim().split('=',2));
    const timestamp=Number(parts.find(([key])=>key==='t')?.[1]);
    const signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value);
    if(!timestamp||Math.abs(Date.now()/1000-timestamp)>300||!signatures.length)throw new ApiError('PAYMENT_WEBHOOK_SIGNATURE_INVALID','Stripe webhook signature is invalid or expired',401);
    const expected=await hmac256(secret,`${timestamp}.${rawBody}`);
    if(!signatures.some(value=>constantTime(expected,value)))throw new ApiError('PAYMENT_WEBHOOK_SIGNATURE_INVALID','Stripe webhook signature is invalid',401);
    const event=JSON.parse(rawBody) as any;
    const object=event.data?.object??{};
    const isCheckout=String(object.object??'')==='checkout.session';
    const attemptId=object.client_reference_id??object.metadata?.attemptId;
    let status:VerifiedPaymentEvent['status']='processing';
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')status='succeeded';
    else if(event.type==='checkout.session.expired')status='cancelled';
    else if(event.type==='checkout.session.async_payment_failed')status='failed';
    else if(isCheckout)status=statusOf(object);
    return{eventId:String(event.id),eventType:String(event.type??'unknown'),providerPaymentId:isCheckout&&object.id?String(object.id):undefined,attemptId:attemptId?String(attemptId):undefined,status,amountMinor:Number.isFinite(Number(object.amount_total))?Number(object.amount_total):undefined,currency:object.currency?String(object.currency).toUpperCase():undefined,raw:event};
  }

  async verifyPayment(config:PaymentProviderConfiguration,providerPaymentId:string,signal:AbortSignal):Promise<VerifiedPaymentEvent>{
    const session=await stripeRequest<any>(config,`/checkout/sessions/${encodeURIComponent(providerPaymentId)}`,{},signal);
    return{eventId:`verify:${session.id}:${session.status}:${session.payment_status}`,eventType:'checkout.session.verify',providerPaymentId:String(session.id),attemptId:session.client_reference_id??session.metadata?.attemptId,status:statusOf(session),amountMinor:Number.isFinite(Number(session.amount_total))?Number(session.amount_total):undefined,currency:session.currency?String(session.currency).toUpperCase():undefined,raw:session};
  }

  async refund(config:PaymentProviderConfiguration,providerPaymentId:string,amountMinor:number,signal:AbortSignal){
    const session=await stripeRequest<any>(config,`/checkout/sessions/${encodeURIComponent(providerPaymentId)}`,{},signal);
    if(!session.payment_intent)throw new ApiError('STRIPE_REFUND_UNAVAILABLE','Stripe Checkout session has no payment intent to refund',409);
    const refund=await stripeRequest<any>(config,'/refunds',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:formBody({payment_intent:String(session.payment_intent),amount:amountMinor})},signal);
    return{providerRefundId:String(refund.id),status:String(refund.status??'pending')};
  }
}
