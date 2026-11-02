import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPoseQuoteRequest, buildPoseSubmitRequest, poseQuoteAllowed } from '../src/site/pose-provider.server.ts';

test('person and pose use ordered private file IDs and a fixed official channel', () => {
  const request = buildPoseQuoteRequest({photoFileId:'file_person',poseFileId:'file_pose',instructions:'keep clothing'});
  assert.deepEqual(request.input.references.map((ref)=>ref.file_id), ['file_person','file_pose']);
  assert.match(request.input.prompt, /first reference is the person photo.*second reference is the pose reference/);
  assert.deepEqual(request.routing,{only:['official'],fallback:false,fidelity:'original'});
  assert.deepEqual(buildPoseSubmitRequest(request),{...request,max_cost:'0.30'});
  assert.throws(()=>buildPoseQuoteRequest({photoFileId:'https://evil.example',instructions:'sit'}));
  assert.throws(()=>buildPoseQuoteRequest({photoFileId:'file_person',instructions:''}));
});

test('rejects unavailable, expired or over-budget quotes including fractional excess', () => {
  const now = 1000;
  const q = {currency:'USD',supply:{available:true},primary:{amount:'0.15'},expected_amount:'0.15',expires_at:2};
  assert.equal(poseQuoteAllowed(q,now),true);
  for (const change of [{primary:{amount:'0.15001'}},{expected_amount:'0.15001'},{currency:'EUR'},{expires_at:1},{supply:{available:false}},{primary:{amount:'NaN'}}]) assert.equal(poseQuoteAllowed({...q,...change},now),false);
});
