import { Environment, ScanSemanticMode, WaffoPancake, type ScanAction } from '@waffo/pancake-ts';

export type PromptSafetyVerdict = { action: ScanAction };
export type PromptScanner = { scanPrompt(prompt: string): Promise<PromptSafetyVerdict> };

export function createWaffoPromptScanner(options: {
  merchantId: string;
  privateKey: string;
  environment: 'test' | 'prod';
  fetcher?: typeof fetch;
}): PromptScanner {
  const client = new WaffoPancake({
    merchantId: options.merchantId,
    privateKey: options.privateKey,
    environment: options.environment === 'prod' ? Environment.Prod : Environment.Test,
    ...(options.fetcher ? { fetch: options.fetcher } : {}),
  });
  return {
    async scanPrompt(prompt) {
      const verdict = await client.contentSafety.scanPrompt({ prompt, locale: 'en', semantic: ScanSemanticMode.Enforce });
      return { action: verdict.action };
    },
  };
}
