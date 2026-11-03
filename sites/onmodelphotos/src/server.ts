import handler from '@tanstack/react-start/server-entry';
import { core } from '~/core.server';
import { paraglideMiddleware } from '~/paraglide/server.js';
import { garmentLedger } from './site/garment-billing.server';
import { handleGarmentHttp, type GarmentHttpEnv } from './site/garment-http.server';
import { createGarmentWorkflowDependencies } from './site/garment-workflow.server';
import { scheduleGarmentRecoveries } from './site/garment-recovery-scheduler.server';
export { GarmentWorkflow } from './site/garment-workflow.cloudflare';

// The template's generic jobs/upload API stays closed; garment generation, billing
// and auth are served from their own verified routes below.
export default {
  async scheduled(_event, env) {
    const garment=env as Env & {GARMENT_TRIAL_ENABLED?:string; GARMENT_MEDIA?:R2Bucket; GARMENT_WORKFLOW?:GarmentHttpEnv['workflow']; GARMENT_RESULT_HOSTS?:string; GARMENT_UPLOAD_HOSTS?:string; WAFFO_MERCHANT_ID?:string; WAFFO_PRIVATE_KEY?:string; WAFFO_ENVIRONMENT?:string};
    if(garment.GARMENT_TRIAL_ENABLED!=='true'||!garment.GARMENT_MEDIA||!garment.GARMENT_WORKFLOW)return;
    const deps=createGarmentWorkflowDependencies({DB:garment.DB,GARMENT_MEDIA:garment.GARMENT_MEDIA,YIR_API_KEY:garment.YIR_API_KEY,GARMENT_RESULT_HOSTS:garment.GARMENT_RESULT_HOSTS??'',GARMENT_UPLOAD_HOSTS:garment.GARMENT_UPLOAD_HOSTS??'',WAFFO_MERCHANT_ID:garment.WAFFO_MERCHANT_ID,WAFFO_PRIVATE_KEY:garment.WAFFO_PRIVATE_KEY,WAFFO_ENVIRONMENT:garment.WAFFO_ENVIRONMENT},undefined,undefined,garmentLedger(garment.DB).refund);
    await scheduleGarmentRecoveries(deps,{workflow:garment.GARMENT_WORKFLOW});
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.onmodelphotos.com') {
      url.hostname = 'onmodelphotos.com';
      return Response.redirect(url, 308);
    }
    const pathname = url.pathname;
    // Fail closed unless all bindings and a single explicit HTTPS origin are configured.
    // Activation is separate from deployment and requires the full workflow and data lifecycle.
    if (/^\/api\/garment(?:\/|$)/.test(pathname)) {
      const garment = env as Env & {GARMENT_STAGING?:string; GARMENT_STAGE_TOKEN?:string; GARMENT_TRIAL_ENABLED?:string; GARMENT_ALLOWED_ORIGIN?:string; GARMENT_MEDIA?:R2Bucket; GARMENT_WORKFLOW?:GarmentHttpEnv['workflow']; GARMENT_RESULT_HOSTS?:string; GARMENT_UPLOAD_HOSTS?:string; GARMENT_IP_SECRET?:string; WAFFO_MERCHANT_ID?:string; WAFFO_PRIVATE_KEY?:string; WAFFO_ENVIRONMENT?:string};
      if (garment.GARMENT_TRIAL_ENABLED !== 'true') return new Response('Not found', {status:404,headers:{'Cache-Control':'no-store'}});
      if (garment.GARMENT_STAGING === 'true') {
        const expected=garment.GARMENT_STAGE_TOKEN??'', supplied=request.headers.get('x-garment-stage-token')??'';
        let diff=expected.length^supplied.length;
        for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(supplied.charCodeAt(i)||0);
        if(expected.length<32||diff!==0)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
      }
      let allowedOrigin: string;
      try {
        const parsed=new URL(garment.GARMENT_ALLOWED_ORIGIN ?? '');
        if (parsed.protocol!=='https:' || parsed.origin!==garment.GARMENT_ALLOWED_ORIGIN || parsed.username || parsed.password) throw new Error('Invalid origin');
        allowedOrigin=parsed.origin;
      } catch { return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}}); }
      if (url.origin!==allowedOrigin || !garment.DB || !garment.GARMENT_MEDIA || !garment.GARMENT_WORKFLOW || !garment.GUEST_COOKIE_SECRET || !garment.GARMENT_IP_SECRET || garment.GARMENT_IP_SECRET.length<32) return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
      if(request.method==='POST') {
        try { createGarmentWorkflowDependencies({DB:garment.DB,GARMENT_MEDIA:garment.GARMENT_MEDIA,YIR_API_KEY:garment.YIR_API_KEY,GARMENT_RESULT_HOSTS:garment.GARMENT_RESULT_HOSTS??'',GARMENT_UPLOAD_HOSTS:garment.GARMENT_UPLOAD_HOSTS??'',WAFFO_MERCHANT_ID:garment.WAFFO_MERCHANT_ID,WAFFO_PRIVATE_KEY:garment.WAFFO_PRIVATE_KEY,WAFFO_ENVIRONMENT:garment.WAFFO_ENVIRONMENT},undefined,undefined,garmentLedger(garment.DB).refund); }
        catch { return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}}); }
      }
      return handleGarmentHttp(request,{db:garment.DB,bucket:garment.GARMENT_MEDIA,workflow:garment.GARMENT_WORKFLOW,origin:allowedOrigin,cookieSecret:garment.GUEST_COOKIE_SECRET,ipHashSecret:garment.GARMENT_IP_SECRET,authUser:(request)=>core.getUser(request),ledger:garmentLedger(garment.DB)});
    }
    const openApi = /^\/(?:api\/garment|api\/auth|api\/billing|api\/webhooks)(?:\/|$)/.test(pathname);
    if ((!openApi && /^\/api(?:\/|$)/.test(pathname)) || /^\/files(?:\/|$)/.test(pathname)) return new Response('Not found', { status: 404 });
    const response = await (import.meta.env.DEV
      ? paraglideMiddleware(request, () => handler.fetch(request))
      : handler.fetch(request));
    if ((env as Env & {GARMENT_STAGING?:string}).GARMENT_STAGING !== 'true') return response;
    const headers=new Headers(response.headers);
    headers.set('X-Robots-Tag','noindex, nofollow');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
} satisfies ExportedHandler<Env>;
