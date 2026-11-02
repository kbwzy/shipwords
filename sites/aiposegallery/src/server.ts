import handler from '@tanstack/react-start/server-entry';
import { core } from '~/core.server';
import { paraglideMiddleware } from '~/paraglide/server.js';
import { poseLedger } from './site/pose-billing.server';
import { handlePoseHttp, type PoseHttpEnv } from './site/pose-http.server';
import { createPoseWorkflowDependencies } from './site/pose-workflow.server';
import { schedulePoseRecoveries } from './site/pose-recovery-scheduler.server';
export { PoseWorkflow } from './site/pose-workflow.cloudflare';

// The template's generic jobs/upload API stays closed; pose generation, billing
// and auth are served from their own verified routes below.
export default {
  async scheduled(_event, env) {
    const pose=env as Env & {POSE_TRIAL_ENABLED?:string; POSE_MEDIA?:R2Bucket; POSE_WORKFLOW?:PoseHttpEnv['workflow']; POSE_RESULT_HOSTS?:string; POSE_UPLOAD_HOSTS?:string; WAFFO_MERCHANT_ID?:string; WAFFO_PRIVATE_KEY?:string; WAFFO_ENVIRONMENT?:string};
    if(pose.POSE_TRIAL_ENABLED!=='true'||!pose.POSE_MEDIA||!pose.POSE_WORKFLOW)return;
    const deps=createPoseWorkflowDependencies({DB:pose.DB,POSE_MEDIA:pose.POSE_MEDIA,YIR_API_KEY:pose.YIR_API_KEY,POSE_RESULT_HOSTS:pose.POSE_RESULT_HOSTS??'',POSE_UPLOAD_HOSTS:pose.POSE_UPLOAD_HOSTS??'',WAFFO_MERCHANT_ID:pose.WAFFO_MERCHANT_ID,WAFFO_PRIVATE_KEY:pose.WAFFO_PRIVATE_KEY,WAFFO_ENVIRONMENT:pose.WAFFO_ENVIRONMENT},undefined,undefined,poseLedger(pose.DB).refund);
    await schedulePoseRecoveries(deps,{workflow:pose.POSE_WORKFLOW});
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.aiposegallery.com') {
      url.hostname = 'aiposegallery.com';
      return Response.redirect(url, 308);
    }
    const pathname = url.pathname;
    // Fail closed unless all bindings and a single explicit HTTPS origin are configured.
    // Activation is separate from deployment and requires the full workflow and data lifecycle.
    if (/^\/api\/pose(?:\/|$)/.test(pathname)) {
      const pose = env as Env & {POSE_STAGING?:string; POSE_STAGE_TOKEN?:string; POSE_TRIAL_ENABLED?:string; POSE_ALLOWED_ORIGIN?:string; POSE_MEDIA?:R2Bucket; POSE_WORKFLOW?:PoseHttpEnv['workflow']; POSE_RESULT_HOSTS?:string; POSE_UPLOAD_HOSTS?:string; POSE_IP_SECRET?:string; WAFFO_MERCHANT_ID?:string; WAFFO_PRIVATE_KEY?:string; WAFFO_ENVIRONMENT?:string};
      if (pose.POSE_TRIAL_ENABLED !== 'true') return new Response('Not found', {status:404,headers:{'Cache-Control':'no-store'}});
      if (pose.POSE_STAGING === 'true') {
        const expected=pose.POSE_STAGE_TOKEN??'', supplied=request.headers.get('x-pose-stage-token')??'';
        let diff=expected.length^supplied.length;
        for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(supplied.charCodeAt(i)||0);
        if(expected.length<32||diff!==0)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
      }
      let allowedOrigin: string;
      try {
        const parsed=new URL(pose.POSE_ALLOWED_ORIGIN ?? '');
        if (parsed.protocol!=='https:' || parsed.origin!==pose.POSE_ALLOWED_ORIGIN || parsed.username || parsed.password) throw new Error('Invalid origin');
        allowedOrigin=parsed.origin;
      } catch { return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}}); }
      if (url.origin!==allowedOrigin || !pose.DB || !pose.POSE_MEDIA || !pose.POSE_WORKFLOW || !pose.GUEST_COOKIE_SECRET || !pose.POSE_IP_SECRET || pose.POSE_IP_SECRET.length<32) return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
      if(request.method==='POST') {
        try { createPoseWorkflowDependencies({DB:pose.DB,POSE_MEDIA:pose.POSE_MEDIA,YIR_API_KEY:pose.YIR_API_KEY,POSE_RESULT_HOSTS:pose.POSE_RESULT_HOSTS??'',POSE_UPLOAD_HOSTS:pose.POSE_UPLOAD_HOSTS??'',WAFFO_MERCHANT_ID:pose.WAFFO_MERCHANT_ID,WAFFO_PRIVATE_KEY:pose.WAFFO_PRIVATE_KEY,WAFFO_ENVIRONMENT:pose.WAFFO_ENVIRONMENT},undefined,undefined,poseLedger(pose.DB).refund); }
        catch { return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}}); }
      }
      return handlePoseHttp(request,{db:pose.DB,bucket:pose.POSE_MEDIA,workflow:pose.POSE_WORKFLOW,origin:allowedOrigin,cookieSecret:pose.GUEST_COOKIE_SECRET,ipHashSecret:pose.POSE_IP_SECRET,authUser:(request)=>core.getUser(request),ledger:poseLedger(pose.DB)});
    }
    const openApi = /^\/(?:api\/pose|api\/auth|api\/billing|api\/webhooks)(?:\/|$)/.test(pathname);
    if ((!openApi && /^\/api(?:\/|$)/.test(pathname)) || /^\/files(?:\/|$)/.test(pathname)) return new Response('Not found', { status: 404 });
    const response = await (import.meta.env.DEV
      ? paraglideMiddleware(request, () => handler.fetch(request))
      : handler.fetch(request));
    if ((env as Env & {POSE_STAGING?:string}).POSE_STAGING !== 'true') return response;
    const headers=new Headers(response.headers);
    headers.set('X-Robots-Tag','noindex, nofollow');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
} satisfies ExportedHandler<Env>;
