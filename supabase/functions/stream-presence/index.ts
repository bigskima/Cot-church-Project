import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertObject,requiredString,uuid } from "../_shared/validation.ts";
Deno.serve(createHandler({methods:["POST"],authentication:"required",organization:"optional"},async({request,auth})=>{const body=assertObject(await jsonBody(request)),sessionId=uuid(requiredString(body.sessionId,"sessionId",36),"sessionId",true)!,action=requiredString(body.action,"action",20);const{data,error}=await auth!.client.rpc("update_stream_presence",{target_session_id:sessionId,presence_action:action});if(error)throw new ApiError("PRESENCE_UPDATE_FAILED","Unable to update viewing attendance",400);return{data};}));
