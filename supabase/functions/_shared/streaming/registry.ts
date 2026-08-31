import { ApiError } from '../errors.ts';
import { MuxStreamingProvider } from './mux.ts';
import type{StreamingProvider } from './types.ts';const adapters:Record<string,StreamingProvider>={mux:new MuxStreamingProvider()};
export function streamingProvider(code:string){const adapter=adapters[code];if(!adapter)throw new ApiError('STREAMING_ADAPTER_UNAVAILABLE',`Streaming adapter ${code} is not installed`,501,undefined,false);return adapter}
