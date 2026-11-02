import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posePrompt } from '../src/site/pose-prompt.server.ts';

test('distinguishes the person and pose references across supported modes', () => {
  assert.match(posePrompt({ hasPhoto: true, hasPose: true, instructions: '' }), /first reference is the person photo.*second reference is the pose reference/);
  assert.match(posePrompt({ hasPhoto: true, hasPose: false, instructions: 'turn left' }), /person photo.*User instructions: turn left/s);
  assert.match(posePrompt({ hasPhoto: false, hasPose: true, instructions: '' }), /Create a new person; do not copy/);
  assert.match(posePrompt({ hasPhoto: false, hasPose: false, instructions: 'standing' }), /Create a new person based on the requested pose/);
});
