export type PaymentAttemptLifecycle='created'|'requires_action'|'processing'|'succeeded'|'failed'|'cancelled';

export type PaymentProviderConfiguration={
  configId:string;
  organizationId:string|null;
  providerId:string;
  providerCode:string;
  providerName:string;
  environment:'production'|'sandbox';
  secretReference:string;
  webhookSecretReference:string;
  settings:Record<string,unknown>;
};

export type PaymentCheckoutRequest={
  attemptId:string;
  donationId:string;
  amountMinor:number;
  currency:string;
  paymentMethod:string;
  email:string;
  description:string;
  metadata:Record<string,string>;
};

export type PaymentCheckoutResult={
  providerPaymentId:string;
  status:PaymentAttemptLifecycle;
  checkoutUrl?:string;
  accessCode?:string;
  clientSecret?:string;
  expiresAt?:string;
  rawMetadata?:Record<string,unknown>;
};

export type VerifiedPaymentEvent={
  eventId:string;
  eventType:string;
  providerPaymentId?:string;
  attemptId?:string;
  status:PaymentAttemptLifecycle;
  amountMinor?:number;
  currency?:string;
  raw:Record<string,unknown>;
};

export interface PaymentProviderAdapter{
  readonly code:string;
  initialize(config:PaymentProviderConfiguration,request:PaymentCheckoutRequest,signal:AbortSignal):Promise<PaymentCheckoutResult>;
  verifyWebhook(config:PaymentProviderConfiguration,rawBody:string,headers:Headers):Promise<VerifiedPaymentEvent>;
  verifyPayment(config:PaymentProviderConfiguration,providerPaymentId:string,signal:AbortSignal):Promise<VerifiedPaymentEvent>;
  refund(config:PaymentProviderConfiguration,providerPaymentId:string,amountMinor:number,signal:AbortSignal):Promise<{providerRefundId:string;status:string}>;
}
