import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPoseApi, isPoseJobPending, poseResultUrl, PoseGeneratorPreview, parseSavedPoseTask, shouldPollPoseJob, retryPoseInput } from '../src/site/pose-generator-preview';

describe('pose workspace API', () => {
  it('defaults to the unavailable local preview; the remote test integration requires explicit opt-in', () => {
    const props = { choice: null, library: [], onChoose: () => {} };
    const defaultHtml = renderToStaticMarkup(createElement(PoseGeneratorPreview, props));
    const remoteHtml = renderToStaticMarkup(createElement(PoseGeneratorPreview, { ...props, apiMode: 'remote' }));
    expect(defaultHtml).toContain('Generation is not available here');
    expect(defaultHtml).not.toContain('Test integration');
    expect(remoteHtml).toContain('A limited guest trial may be available. Signed-in requests use one credit from a one-time pack.');
    expect(remoteHtml).not.toContain('Free tier: up to 3 requests per visitor each UTC day');
  });
  it('retains both task id and key across refresh, including older saved records', () => {
    const id = '01234567-89ab-4cde-8fab-0123456789ab';
    expect(parseSavedPoseTask(JSON.stringify({ id, key: 'request-key-1' }))).toEqual({ id, key: 'request-key-1' });
    expect(parseSavedPoseTask(JSON.stringify({ id }))).toEqual({ id });
    expect(parseSavedPoseTask(JSON.stringify({ key: 'request-key-1' }))).toEqual({ key: 'request-key-1' });
    expect(parseSavedPoseTask('{bad')).toBeNull();
  });

  it('stops polling when input or support is required', () => {
    expect(shouldPollPoseJob('accepted')).toBe(true);
    expect(shouldPollPoseJob('unknown')).toBe(true);
    for (const status of ['input_required', 'needs_attention', 'succeeded', 'failed']) expect(shouldPollPoseJob(status)).toBe(false);
    expect(isPoseJobPending('needs_attention')).toBe(true);
    expect(isPoseJobPending('input_required')).toBe(true);
  });

  it('retries with the original key and retained form, or reconstructed input after refresh', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const api = createPoseApi('remote', fetcher as typeof fetch);
    const original = new FormData(); original.set('prompt', 'original'); original.set('consent', 'yes');
    const reselected = new FormData(); reselected.set('prompt', 'reselected'); reselected.set('consent', 'yes');
    await retryPoseInput(api, 'request-key-1', original, reselected);
    await retryPoseInput(api, 'request-key-1', null, reselected);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ body: original, headers: { 'Idempotency-Key': 'request-key-1' } });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ body: reselected, headers: { 'Idempotency-Key': 'request-key-1' } });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/pose/jobs', '/api/pose/jobs']);
  });
  it('uses the same-origin session, multipart job, recovery key, and status routes', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'job-1', status: 'accepted' }), { headers: { 'content-type': 'application/json' } }));
    const api = createPoseApi('remote', fetcher as typeof fetch);
    const form = new FormData();
    form.set('prompt', 'stand'); form.set('consent', 'yes');
    await api.startSession();
    await api.create(form, 'request-key-1');
    await api.recover('request-key-1');
    await api.getJob('job-1');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/pose/session', '/api/pose/jobs', '/api/pose/recover', '/api/pose/jobs/job-1']);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', headers: { 'Idempotency-Key': 'request-key-1' }, body: form, credentials: 'same-origin' });
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({ headers: { 'Idempotency-Key': 'request-key-1' }, credentials: 'same-origin', cache: 'no-store' });
  });

  it('retains the existing local endpoints', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const api = createPoseApi('local', fetcher as typeof fetch);
    await api.startSession(); await api.create(new FormData(), 'request-key-1'); await api.recover('request-key-1'); await api.getJob('job-1');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['http://127.0.0.1:6045/generate', 'http://127.0.0.1:6045/jobs/recover', 'http://127.0.0.1:6045/jobs/job-1']);
  });

  it('keeps uncertain and new states pending and restricts result URLs to the expected service', () => {
    for (const status of ['accepted', 'preparing', 'quoted', 'submitting', 'submitted', 'result_pending', 'unknown', 'queued', 'running', 'future_state']) expect(isPoseJobPending(status)).toBe(true);
    expect(isPoseJobPending('succeeded')).toBe(false); expect(isPoseJobPending('failed')).toBe(false);
    expect(poseResultUrl('remote', 'job-1', '/api/pose/jobs/job-1/result')).toBe('/api/pose/jobs/job-1/result');
    expect(poseResultUrl('remote', 'job-1', 'https://evil.example/image')).toBeNull();
    expect(poseResultUrl('remote', 'job-1', '/api/pose/jobs/other/result')).toBeNull();
    expect(poseResultUrl('local', 'job-1', '/result/job-1')).toBe('http://127.0.0.1:6045/result/job-1');
  });
});
