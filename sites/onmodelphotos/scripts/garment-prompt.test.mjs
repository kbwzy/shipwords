import { test } from 'node:test';
import assert from 'node:assert/strict';
import { garmentPrompt, isUnsupportedMultiPersonPrompt, isOutOfScopeGarmentPrompt } from '../src/site/garment-prompt.server.ts';

test('distinguishes garment and model references across supported modes', () => {
  assert.match(garmentPrompt({ hasGarment: true, hasModel: true, instructions: '' }), /first reference is a garment product photo.*second reference is a model reference/s);
  assert.match(garmentPrompt({ hasGarment: true, hasModel: false, instructions: 'turn left' }), /The only reference is a garment product photo.*User instructions: turn left/s);
  assert.match(garmentPrompt({ hasGarment: false, hasModel: true, instructions: '' }), /preserve that person.s identity/);
  assert.match(garmentPrompt({ hasGarment: false, hasModel: false, instructions: 'standing' }), /User instructions: standing/);
});

test('rejects swimwear and underwear instructions as out of product scope', () => {
  for (const prompt of ['a bikini top', 'lingerie set photo', 'swimsuit catalog']) assert.equal(isOutOfScopeGarmentPrompt(prompt), true);
  assert.equal(isOutOfScopeGarmentPrompt('a wool sweater'), false);
});

test('blocks multi-person instructions while allowing single-person exceptions', () => {
  assert.equal(isUnsupportedMultiPersonPrompt('a couple holding hands'), true);
  assert.equal(isUnsupportedMultiPersonPrompt('two models side by side'), true);
  assert.equal(isUnsupportedMultiPersonPrompt('blowing a kiss to the camera'), false);
  assert.equal(isUnsupportedMultiPersonPrompt('one model standing'), false);
});
