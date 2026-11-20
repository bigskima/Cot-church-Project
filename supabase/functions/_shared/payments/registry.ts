import { ApiError } from '../errors.ts';
import { PaystackPaymentProvider } from './paystack.ts';
import { StripePaymentProvider } from './stripe.ts';
import type { PaymentProviderAdapter } from './types.ts';

const adapters:Record<string,PaymentProviderAdapter>={
  paystack:new PaystackPaymentProvider(),
  stripe:new StripePaymentProvider(),
};

export function paymentProvider(code:string){
  const adapter=adapters[code];
  if(!adapter)throw new ApiError('PAYMENT_ADAPTER_UNAVAILABLE',`Payment adapter ${code} is not installed`,501,undefined,false);
  return adapter;
}
