import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enrichSocialComments, enrichSocialPosts } from "../_shared/public-identity.ts";
import { assertNoUnknownFields,assertObject,requiredString,uuid } from "../_shared/validation.ts";

const visibilities=new Set(["public","organization","branch","group","private"]);
const scopes=new Set(["all","church","expression"]);

Deno.serve(createHandler(
  {methods:["GET","POST"],authentication:"required",organization:"required"},
  async({request,auth})=>{
    if(!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED","Organization context is required",400);

    if(request.method==="GET"){
      const url=new URL(request.url);
      const postId=uuid(url.searchParams.get("postId"),"postId");
      if(postId){
        const{data,error}=await auth.client.from("social_comments")
          .select("id,post_id,author_membership_id,parent_comment_id,body,is_hidden,created_at,updated_at")
          .eq("post_id",postId).eq("is_hidden",false).order("created_at").limit(200);
        if(error) throw new ApiError("COMMENT_LIST_FAILED","Unable to retrieve comments",500,undefined,false);
        return{data:await enrichSocialComments(data??[])};
      }

      const scope=url.searchParams.get("scope")??"all";
      if(!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED","Invalid community feed scope",422);
      let query=auth.client.from("social_posts")
        .select("id,organization_id,author_membership_id,branch_id,group_id,visibility,status,body,media,published_at,edited_at,created_at,social_reactions(reaction)")
        .eq("organization_id",auth.organizationId)
        .eq("status","published")
        .order("published_at",{ascending:false})
        .limit(100);
      if(scope==="church") query=query.is("branch_id",null).eq("visibility","public");
      if(scope==="expression"){
        if(!auth.branchId) throw new ApiError("EXPRESSION_REQUIRED","Join or select an Expression to view its feed",403);
        query=query.eq("branch_id",auth.branchId);
      }
      const{data,error}=await query;
      if(error) throw new ApiError("FEED_READ_FAILED","Unable to retrieve community feed",500,undefined,false);
      return{data:await enrichSocialPosts(data??[])};
    }

    const body=assertObject(await jsonBody(request));
    if(body.action==="comment"){
      assertNoUnknownFields(body,["action","postId","body","parentCommentId"]);
      const{data,error}=await auth.client.rpc("comment_on_social_post",{
        target_post_id:uuid(requiredString(body.postId,"postId",36),"postId",true),
        comment_body:requiredString(body.body,"body",3000),
        target_parent_comment_id:body.parentCommentId?uuid(String(body.parentCommentId),"parentCommentId",true):null,
      }).single();
      if(error?.code==="42501") throw new ApiError("PERMISSION_DENIED","You do not have access to comment on this post",403);
      if(error) throw new ApiError("COMMENT_CREATE_FAILED","Unable to comment",500,undefined,false);
      return{data,status:201};
    }
    if(body.action==="react"){
      assertNoUnknownFields(body,["action","postId","reaction"]);
      const{data,error}=await auth.client.rpc("react_to_social_post",{
        target_post_id:uuid(requiredString(body.postId,"postId",36),"postId",true),
        target_reaction:requiredString(body.reaction,"reaction",20),
      }).single();
      if(error?.code==="42501") throw new ApiError("PERMISSION_DENIED","You do not have access to react to this post",403);
      if(error) throw new ApiError("REACTION_FAILED","Unable to react",500,undefined,false);
      return{data};
    }

    assertNoUnknownFields(body,["body","visibility","branchId","groupId","media"]);
    const visibility=requiredString(body.visibility,"visibility",20);
    if(!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED","Invalid visibility",422);
    if(body.media!==undefined&&!Array.isArray(body.media)) throw new ApiError("VALIDATION_FAILED","media must be an array",422);
    const{data,error}=await auth.client.rpc("publish_social_post",{
      target_organization_id:auth.organizationId,
      target_visibility:visibility,
      post_body:requiredString(body.body,"body",10000),
      target_branch_id:body.branchId?uuid(String(body.branchId),"branchId",true):null,
      target_group_id:body.groupId?uuid(String(body.groupId),"groupId",true):null,
      post_media:body.media??[],
    }).single();
    if(error?.code==="42501"){
      const message=String(error.message??"");
      if(message.includes("Posting is currently restricted")) throw new ApiError("POSTING_RESTRICTED","Your posting access is currently restricted",403);
      if(message.includes("Expression membership required")) throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED","Join an Expression before posting",403);
      if(message.includes("your own Expression")) throw new ApiError("EXPRESSION_SCOPE_DENIED","You may post only to your own Expression",403);
      throw new ApiError("PERMISSION_DENIED","You do not have permission to publish this post",403);
    }
    if(error) throw new ApiError("POST_CREATE_FAILED","Unable to publish post",500,undefined,false);
    return{data,status:201};
  },
));
