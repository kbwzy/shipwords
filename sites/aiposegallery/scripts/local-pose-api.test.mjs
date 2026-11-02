import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

const dir = await mkdtemp(join(tmpdir(), 'pose-api-test-'));
after(() => rm(dir, { recursive: true, force: true }));
const { createLocalPoseService } = await import('./local-pose-api.mjs').catch(() => ({}));

test('local service implementation exists', () => assert.equal(typeof createLocalPoseService, 'function'));

test('origin, host, validation, budget, duplicates, and concurrent jobs', async () => {
  assert.equal(typeof createLocalPoseService, 'function');
  let quotePrice = '0.15';
  let release;
  let calls = 0;
  const seen = [];
  const provider = {
    upload: async (file, key) => { seen.push(['upload', file.name, key]); return { id: `file-${file.name}`, status: 'ready' }; },
    quote: async request => { seen.push(['quote', request]); return { supply: { available: true }, primary: { amount: quotePrice }, currency: 'USD', expires_at: Math.floor(Date.now()/1000)+60 }; },
    submit: async (request, key) => { calls++; seen.push(['submit', request, key]); await new Promise(resolve => { release = resolve; }); return { id: 'upstream' }; },
    wait: async () => ({ status: 'succeeded', result: { availability: 'available', files: [{ url: 'https://example.test/private', media_type: 'image/png' }] } }),
    download: async () => ({ bytes: png, mediaType: 'image/png' }),
  };
  const service = await createLocalPoseService({ provider, stateDir: dir });
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  after(() => new Promise(resolve => service.server.close(resolve)));
  const port = service.server.address().port;
  const send = (method, path, { origin = 'http://localhost:6044', host = 'localhost:6045', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: { host, ...(origin === null ? {} : { origin }), ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }); req.on('error', reject); req.end(body);
  });
  const json = res => JSON.parse(res.body.toString());
  const form = async (fields, key = 'task-00000001') => {
    const data = new FormData(); for (const [name, value] of fields) data.append(name, value);
    const req = new Request('http://local', { method: 'POST', body: data });
    return send('POST', '/generate', { headers: { 'content-type': req.headers.get('content-type'), 'idempotency-key': key }, body: Buffer.from(await req.arrayBuffer()) });
  };
  assert.deepEqual(json(await send('GET', '/health')), { available: true });
  assert.equal((await send('GET', '/health', { origin: null })).status, 403);
  assert.equal((await send('GET', '/health', { origin: 'https://evil.test' })).status, 403);
  assert.equal((await send('GET', '/health', { host: 'attacker.test:6045' })).status, 403);
  assert.equal((await send('GET', '/jobs/recover')).status, 400);
  assert.equal((await send('GET', '/jobs/recover', { headers: { 'idempotency-key': 'unknown-key-01' } })).status, 404);
  const pre = await send('OPTIONS', '/generate', { origin: 'http://127.0.0.1:6044', headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,idempotency-key' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers['access-control-allow-origin'], 'http://127.0.0.1:6044');
  // dev-port derives 6043 for this site; the service must accept it alongside 6044.
  const pre6043 = await send('OPTIONS', '/generate', { origin: 'http://localhost:6043', headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,idempotency-key' } });
  assert.equal(pre6043.status, 204); assert.equal(pre6043.headers['access-control-allow-origin'], 'http://localhost:6043');
  assert.equal((await send('GET', '/health', { origin: 'http://localhost:6043' })).status, 200);
  assert.equal((await send('GET', '/health', { origin: 'http://localhost:6046' })).status, 403);
  assert.equal((await form([['prompt','hello']])).status, 400);
  assert.equal((await form([['consent','yes']])).status, 400);
  assert.equal((await form([['consent','yes'], ['photo',new File([png], 'person.png', { type: 'image/png' })]])).status, 400);
  assert.equal((await form([['consent','yes'], ['prompt','x'.repeat(2001)]])).status, 400);
  assert.equal((await form([['consent','yes'], ['prompt','hi'], ['model','evil']])).status, 400);
  assert.equal((await form([['consent','yes'], ['photo',new File([png], 'a.png', { type: 'image/jpeg' })]])).status, 400);
  assert.equal((await form([['consent','yes'], ['photo',new File([new Uint8Array(10*1024*1024+1)], 'a.png', { type: 'image/png' })]])).status, 413);
  quotePrice = '0.15001';
  let res = await form([['consent','yes'], ['prompt','hello']], 'task-over-budget');
  assert.equal(res.status, 202);
  const overId = json(res).id;
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(json(await send('GET', `/jobs/${overId}`)).status, 'failed');
  assert.equal(calls, 0);
  quotePrice = '0.15';
  const fields = [['consent','yes'], ['prompt','pose'], ['photo',new File([png], 'person.png', { type: 'image/png' })], ['pose',new File([png], 'pose.png', { type: 'image/png' })]];
  res = await form(fields, 'task-00000002'); assert.equal(res.status, 202);
  const id = json(res).id; assert.equal(json(res).status, 'queued');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls, 1);
  const recovered = json(await send('GET', '/jobs/recover', { headers: { 'idempotency-key': 'task-00000002' } }));
  assert.equal(recovered.id, id); assert.equal(recovered.status, 'running');
  assert.equal((await form(fields, 'task-00000002')).status, 202);
  assert.equal(json(await form(fields, 'task-00000002')).id, id);
  assert.equal((await form([['consent','yes'],['prompt','other']], 'task-00000002')).status, 409);
  assert.equal((await form([['consent','yes'],['prompt','other']], 'task-00000003')).status, 409);
  const sent = seen.find(x => x[0] === 'submit');
  assert.equal(sent[1].max_cost, '0.30');
  assert.deepEqual(sent[1].input.references.map(x => x.file_id), ['file-photo', 'file-pose']);
  assert.deepEqual(sent[1].parameters, { resolution:'1K', aspect_ratio:'3:4', quality:'medium', n:1 });
  release();
  await new Promise(resolve => setTimeout(resolve, 30));
  const job = json(await send('GET', `/jobs/${id}`));
  assert.equal(job.status, 'succeeded'); assert.equal(job.resultUrl, `/result/${id}`);
  assert.equal(json(await send('GET', '/jobs/recover', { headers: { 'idempotency-key': 'task-00000002' } })).resultUrl, job.resultUrl);
  const image = await send('GET', job.resultUrl); assert.deepEqual(image.body, png); assert.equal(image.headers['cache-control'], 'no-store');
});

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const localRequest = (server, method, path, headers, body) => new Promise((resolve, reject) => {
  const req = http.request({ host:'127.0.0.1', port:server.address().port, method, path, headers }, res => {
    const parts = []; res.on('data', part => parts.push(part)); res.on('end', () => resolve({status:res.statusCode, body:JSON.parse(Buffer.concat(parts).toString())}));
  }); req.on('error', reject); req.end(body);
});

test('real SDK uses mocked gateway and file uploads without real network', async () => {
  const { createYirProvider } = await import('./local-pose-api.mjs');
  const seen = [];
  const files = new Map(); let counter = 0;
  const response = object => new Response(JSON.stringify(object), { status: 200, headers: { 'content-type':'application/json' } });
  const fakeFetch = async (url, options = {}) => {
    const u = new URL(url); const method = options.method ?? 'GET';
    seen.push({ host:u.host, path:u.pathname, method, headers: new Headers(options.headers), body: typeof options.body === 'string' ? JSON.parse(options.body) : null });
    if (u.host === 'upload.example.test') return new Response('', {status:200});
    if (u.host === 'result.example.test') return new Response(png, {status:200, headers:{'content-type':'image/png'}});
    assert.equal(u.origin, 'https://gateway.yir.ai');
    if (u.pathname === '/v1/files') {
      const metadata = JSON.parse(options.body).files[0];
      const id = `file_0000000${++counter}-0000-4000-8000-000000000000`;
      const file = { ...metadata, id, object:'file', status:'pending_upload', upload:{type:'multipart', expires_at:Math.floor(Date.now()/1000)+60, parts:[{part_number:1,size:metadata.size,url:'https://upload.example.test/object'}]} };
      files.set(id, file); return response({files:[file]});
    }
    if (u.pathname.endsWith('/complete')) { const id = u.pathname.split('/')[3]; return response({...files.get(id), status:'ready'}); }
    if (u.pathname === '/v1/images/quotes') {
      const req = JSON.parse(options.body); return response({object:'quote', currency:'USD', model:req.model, operation:'generate_image', input_mode:req.input.type, parameters:req.parameters, expires_at:Math.floor(Date.now()/1000)+60, supply:{available:true,issues:[]}, primary:{kind:'fixed',amount:'0.15'}, official:{kind:'fixed',amount:'0.15'}});
    }
    if (u.pathname === '/v1/images/generations') return response({id:'job-123', status:'queued'});
    if (u.pathname.endsWith('/status')) return response({id:'job-123',status:'succeeded',error:null});
    if (u.pathname === '/v1/jobs/job-123') return response({id:'job-123',status:'succeeded',result:{availability:'available',files:[{url:'https://result.example.test/output',media_type:'image/png'}]}});
    throw new Error('Unexpected mock request');
  };
  const provider = await createYirProvider('fake-key', fakeFetch);
  const a = await provider.upload({name:'photo',type:'image/png',data:png}, 'same-key-photo');
  const b = await provider.upload({name:'pose',type:'image/png',data:png}, 'same-key-pose');
  const req = {model:'openai/gpt-image-2.5-sunburst',input:{type:'image',prompt:'person then pose',references:[{role:'reference_image',file_id:a.id},{role:'reference_image',file_id:b.id}]},parameters:{resolution:'1K',aspect_ratio:'3:4',quality:'medium',n:1}};
  assert.equal((await provider.quote(req)).primary.amount, '0.15');
  const submitted = await provider.submit({...req,max_cost:'0.30'}, 'same-key');
  const done = await provider.wait(submitted.id);
  assert.deepEqual((await provider.download(done.result.files[0].url)).bytes, png);
  assert.deepEqual(seen.filter(x => x.path === '/v1/files').map(x => x.headers.get('idempotency-key')), ['same-key-photo','same-key-pose']);
  assert.equal(seen.find(x => x.path === '/v1/images/generations').headers.get('idempotency-key'), 'same-key');
  assert.equal(seen.filter(x => x.host === 'upload.example.test').length, 2);
  assert.equal(seen.find(x => x.host === 'result.example.test').headers.has('authorization'), false);
});

test('ambiguous submission blocks retries across restarts and hides provider errors', async () => {
  const stateDir = await mkdtemp(join(tmpdir(), 'pose-recovery-'));
  after(() => rm(stateDir, {recursive:true,force:true}));
  let submissions = 0;
  const provider = {
    quote: async () => ({supply:{available:true},primary:{amount:'0.10'},currency:'USD',expires_at:Math.floor(Date.now()/1000)+60}),
    submit: async () => { submissions++; throw new Error('secret https://example.test/private'); },
  };
  const start = async () => {
    const service = await createLocalPoseService({provider,stateDir});
    await new Promise(resolve => service.server.listen(0,'127.0.0.1',resolve));
    after(() => { service.server.closeAllConnections(); service.server.close(); });
    return service.server;
  };
  const post = async (server, key, prompt = 'a pose') => {
    const f = new FormData(); f.set('prompt',prompt); f.set('consent','yes');
    const req = new Request('http://test', {method:'POST',body:f});
    return localRequest(server, 'POST', '/generate', {host:'localhost:6045',origin:'http://localhost:6044','idempotency-key':key,'content-type':req.headers.get('content-type')}, Buffer.from(await req.arrayBuffer()));
  };
  let server = await start();
  const first = await post(server,'unknown-key-01'); assert.equal(first.status,202);
  await new Promise(resolve => setTimeout(resolve,30));
  const status = (await localRequest(server, 'GET', `/jobs/${first.body.id}`, {host:'localhost:6045',origin:'http://localhost:6044'})).body;
  assert.equal(status.status,'failed'); assert.match(status.error,/unknown/); assert.doesNotMatch(status.error,/secret|https/);
  assert.equal((await post(server,'other-key-0001')).status,409);
  await new Promise(resolve => server.close(resolve));
  server = await start();
  assert.equal((await localRequest(server, 'GET', '/jobs/recover', {host:'localhost:6045',origin:'http://localhost:6044','idempotency-key':'unknown-key-01'})).status,410);
  assert.equal((await post(server,'unknown-key-01')).status,409);
  assert.equal((await post(server,'other-key-0002')).status,409);
  assert.equal(submissions,1);
  const {stat, readdir} = await import('node:fs/promises');
  for (const name of await readdir(stateDir)) assert.equal((await stat(join(stateDir,name))).mode & 0o777, 0o600);
  await new Promise(resolve => server.close(resolve));
});

test('rejects fractional over-budget quotes and validates text and pose-only modes', async () => {
  const stateDir = await mkdtemp(join(tmpdir(), 'pose-budget-'));
  after(() => rm(stateDir,{recursive:true,force:true}));
  let price = '0.15000000000000000001'; let submitted = [];
  const provider = {
    upload: async () => ({id:'pose-file',status:'ready'}),
    quote: async () => ({supply:{available:true},primary:{amount:price},currency:'USD',expires_at:Math.floor(Date.now()/1000)+60}),
    submit: async request => {submitted.push(request); return {id:'upstream'};},
    wait: async () => ({status:'succeeded',result:{availability:'available',files:[{url:'https://example.test/output',media_type:'image/png'}]}}),
    download: async () => ({bytes:png,mediaType:'image/png'}),
  };
  const {server} = await createLocalPoseService({provider,stateDir});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  after(() => {server.closeAllConnections(); server.close();});
  const headers = {host:'localhost:6045',origin:'http://127.0.0.1:6044'};
  const run = async (key, image) => {
    const form = new FormData(); form.set('consent','yes'); if(image) form.set('pose', new File([png],'pose.png',{type:'image/png'})); else form.set('prompt','standing');
    const req = new Request('http://test', {method:'POST',body:form});
    const response = await localRequest(server, 'POST', '/generate', {...headers,'idempotency-key':key,'content-type':req.headers.get('content-type')},Buffer.from(await req.arrayBuffer()));
    assert.equal(response.status,202); const {id} = response.body;
    for (let i=0;i<50;i++) {const job=(await localRequest(server,'GET',`/jobs/${id}`,headers)).body; if (['failed','succeeded'].includes(job.status)) { await new Promise(resolve=>setTimeout(resolve,5)); return job; } await new Promise(resolve=>setTimeout(resolve,5));}
    assert.fail('Job did not finish');
  };
  assert.equal((await run('precise-price')).status,'failed'); assert.equal(submitted.length,0);
  price='0.15'; assert.equal((await run('text-mode-01')).status,'succeeded');
  assert.equal(submitted[0].input.type,'text'); assert.equal('references' in submitted[0].input,false);
  assert.equal((await run('pose-mode-01',true)).status,'succeeded');
  assert.match(submitted[1].input.prompt,/Create a new person/); assert.equal(submitted[1].input.references[0].file_id,'pose-file');
});

test('bounded chunked body, result validation, and production guard', async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try { await assert.rejects(createLocalPoseService({provider:{}}), /disabled in production/); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
  const stateDir = await mkdtemp(join(tmpdir(),'pose-boundary-'));
  after(() => rm(stateDir,{recursive:true,force:true}));
  const provider = {
    quote:async () => ({supply:{available:true},primary:{amount:'0.01'},currency:'USD',expires_at:Math.floor(Date.now()/1000)+60}),
    submit:async () => ({id:'job-1'}),
    wait:async () => ({status:'succeeded',result:{availability:'available',files:[{url:'https://example.test/output',media_type:'image/png'}]}}),
    download:async () => ({bytes:Buffer.from('not an image'),mediaType:'image/png'}),
  };
  const {server} = await createLocalPoseService({provider,stateDir}); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  after(() => {server.closeAllConnections();server.close();});
  const headers = {host:'127.0.0.1:6045',origin:'http://localhost:6044','idempotency-key':'chunked-key-01','content-type':'multipart/form-data; boundary=x','transfer-encoding':'chunked'};
  const largeStatus = await new Promise((resolve, reject) => {
    const req = http.request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/generate',headers}, res => {
      res.resume(); res.on('end', () => { resolve(res.statusCode); req.destroy(); });
    });
    req.on('error', reject);
    const chunk = Buffer.alloc(65536); let sent = 0;
    function writeMore() {
      while (sent < 20 * 1024 * 1024 + 128 * 1024) { sent += chunk.length; if (!req.write(chunk)) return req.once('drain',writeMore); }
    }
    writeMore();
  });
  assert.equal(largeStatus,413);
  const form = new FormData(); form.set('consent','yes'); form.set('prompt','test'); const req = new Request('http://test',{method:'POST',body:form});
  const created = await localRequest(server,'POST','/generate',{host:'localhost:6045',origin:'http://localhost:6044','idempotency-key':'bad-result-01','content-type':req.headers.get('content-type')},Buffer.from(await req.arrayBuffer()));
  assert.equal(created.status,202);
  await new Promise(resolve=>setTimeout(resolve,30));
  const job = (await localRequest(server,'GET',`/jobs/${created.body.id}`,{host:'localhost:6045',origin:'http://localhost:6044'})).body;
  assert.equal(job.status,'failed'); assert.equal(job.resultUrl,undefined);
  assert.equal((await localRequest(server,'GET',`/result/${created.body.id}`,{host:'localhost:6045',origin:'http://localhost:6044'})).status,404);
});
