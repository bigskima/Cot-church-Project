import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { resolvePaymentRoute } from "../_shared/payments/configuration.ts";
import { assertNoUnknownFields,assertObject,optionalString,requiredString,uuid } from "../_shared/validation.ts";

function money(value:unknown){const amount=Number(value);if(!Number.isSafeInteger(amount)||amount<1||amount>100000000000)throw new ApiError('VALIDATION_FAILED','amountMinor must be a positive safe integer',422);return amount;}
function currency(value:unknown){const code=requiredString(value,'currency',3).toUpperCase();if(!/^[A-Z]{3}$/.test(code))throw new ApiError('VALIDATION_FAILED','currency must be a 3-letter ISO code',422);return code;}
function paymentMethod(value:unknown){const method=requiredString(value??'cards','paymentMethod',40).toLowerCase();if(!/^[a-z][a-z0-9_]{1,39}$/.test(method))throw new ApiError('VALIDATION_FAILED','Invalid payment method',422);return method;}

Deno.serve(createHandler(
  {methods:['POST'],authentication:'required',organization:'required'},
  async({request,auth})=>{
    if(!auth?.organizationId)throw new ApiError('ORGANIZATION_REQUIRED','Organization context is required',400);
    if(!auth.user.email)throw new ApiError('PAYMENT_EMAIL_REQUIRED','Add a verified email address before using online giving',409);
    const body=assertObject(await jsonBody(request));
    assertNoUnknownFields(body,['scope','purposeId','campaignId','amountMinor','currency','paymentMethod','idempotencyKey','anonymous','note']);
    const scope=optionalString(body.scope,'scope',20)??'expression';
    if(!['church','expression'].includes(scope))throw new ApiError('VALIDATION_FAILED','scope must be church or expression',422);
    const targetBranchId=scope==='church'?null:auth.branchId;
    if(scope==='expression'&&!targetBranchId)throw new ApiError('EXPRESSION_REQUIRED','Join or select an Expression before giving to an Expression',403);

    const amountMinor=money(body.amountMinor),currencyCode=currency(body.currency),method=paymentMethod(body.paymentMethod);
    const purposeId=body.purposeId?uuid(String(body.purposeId),'purposeId',true)!:null;
    const campaignId=body.campaignId?uuid(String(body.campaignId),'campaignId',true)!:null;
    const idempotencyKey=requiredString(body.idempotencyKey,'idempotencyKey',128);
    if(!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))throw new ApiError('VALIDATION_FAILED','Invalid idempotency key',422);

    let settingsQuery=auth.client.from('giving_settings').select('id,is_enabled,online_payment_enabled').eq('organization_id',auth.organizationId);
    settingsQuery=targetBranchId?settingsQuery.eq('branch_id',targetBranchId):settingsQuery.is('branch_id',null);
    const{data:settings,error:settingsError}=await settingsQuery.maybeSingle();
    if(settingsError)throw new ApiError('GIVING_SETTINGS_FAILED','Unable to verify giving settings',500,undefined,false);
    if(!settings?.is_enabled||!settings.online_payment_enabled)throw new ApiError('ONLINE_GIVING_UNAVAILABLE','Online giving is not enabled for this giving destination',409);

    const{resolved,adapter}=await resolvePaymentRoute(auth.organizationId,currencyCode,method,'production');
    const admin=adminClient();
    const{data:intent,error:intentError}=await admin.rpc('create_online_donation_intent',{
      target_profile_id:auth.user.id,
      target_organization_id:auth.organizationId,
      target_branch_id:targetBranchId,
      target_purpose_id:purposeId,
      target_campaign_id:campaignId,
      target_amount_minor:amountMinor,
      target_currency:currencyCode,
      target_provider:resolved.providerCode,
      target_idempotency_key:idempotencyKey,
      make_anonymous:body.anonymous===true,
      donor_message:optionalString(body.note,'note',1000)??'',
    });
    if(intentError?.code==='23514')throw new ApiError('IDEMPOTENCY_CONFLICT','This checkout retry does not match the original donation',409);
    if(intentError?.code==='42501')throw new ApiError('GIVING_SCOPE_DENIED',intentError.message,403);
    if(intentError)throw new ApiError('DONATION_INTENT_FAILED',intentError.message??'Unable to create donation intent',500,undefined,false);
    const intentRow=Array.isArray(intent)?intent[0]:intent;
    if(!intentRow?.payment_attempt_id||!intentRow?.donation_id)throw new ApiError('DONATION_INTENT_FAILED','Donation intent did not return an attempt',500,undefined,false);

    const{data:attempt,error:attemptError}=await admin.from('payment_attempts').select('id,donation_id,provider,provider_payment_id,status,checkout_data').eq('id',intentRow.payment_attempt_id).eq('organization_id',auth.organizationId).single();
    if(attemptError||!attempt)throw new ApiError('PAYMENT_ATTEMPT_NOT_FOUND','Payment attempt is unavailable',500,undefined,false);
    const existingCheckout=(attempt.checkout_data??{}) as Record<string,unknown>;
    if(attempt.status!=='created'&&(existingCheckout.checkoutUrl||existingCheckout.clientSecret||attempt.status==='succeeded')){
      return{data:{donationId:attempt.donation_id,paymentAttemptId:attempt.id,provider:attempt.provider,status:attempt.status,checkoutUrl:existingCheckout.checkoutUrl??null,accessCode:existingCheckout.accessCode??null,clientSecret:existingCheckout.clientSecret??null,expiresAt:existingCheckout.expiresAt??null,reused:true}};
    }

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25_000);
    try{
      const checkout=await adapter.initialize(resolved,{
        attemptId:attempt.id,
        donationId:attempt.donation_id,
        amountMinor,
        currency:currencyCode,
        paymentMethod:method,
        email:auth.user.email,
        description:purposeId?'Church giving':'Church donation',
        metadata:{organizationId:auth.organizationId,branchId:targetBranchId??'',purposeId:purposeId??'',campaignId:campaignId??''},
      },controller.signal);
      const checkoutData={checkoutUrl:checkout.checkoutUrl??null,accessCode:checkout.accessCode??null,clientSecret:checkout.clientSecret??null,expiresAt:checkout.expiresAt??null,providerConfigId:resolved.configId};
      const{error:updateError}=await admin.from('payment_attempts').update({provider_payment_id:checkout.providerPaymentId,status:checkout.status,checkout_data:checkoutData,failure_code:null,failure_message:null}).eq('id',attempt.id).eq('status','created');
      if(updateError)throw new ApiError('PAYMENT_ATTEMPT_UPDATE_FAILED','Provider initialized but checkout state could not be saved',500,undefined,false);
      return{data:{donationId:attempt.donation_id,paymentAttemptId:attempt.id,provider:resolved.providerCode,status:checkout.status,...checkoutData,reused:false},status:201};
    }catch(error){
      const code=error instanceof ApiError?error.code:'PAYMENT_INITIALIZATION_FAILED';
      const message=error instanceof Error?error.message:'Unable to initialize payment';
      await admin.from('payment_attempts').update({status:'failed',failure_code:code,failure_message:message}).eq('id',attempt.id).eq('status','created');
      await admin.from('donations').update({status:'failed'}).eq('id',attempt.donation_id).eq('status','pending');
      throw error;
    }finally{clearTimeout(timer);}
  },
));
