import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRenderSpec } from '../src/render/renderSpec.ts';
import {
  DEFAULT_BUTTON_SIZE,
  DEFAULT_BUTTON_TEXT,
  DEFAULT_BUTTON_TYPE,
  DEFAULT_BUTTON_X,
  DEFAULT_BUTTON_Y,
  DEFAULT_LOGO_SIZE,
  DEFAULT_LOGO_X,
  DEFAULT_LOGO_Y,
} from '../src/render/overlayDefaults.ts';
import { createDefaultButtonState, createDefaultLogoState } from '../src/render/resetState.ts';

test('logo reset helper returns canonical default state', () => {
  assert.deepEqual(createDefaultLogoState(), {
    image: null,
    imageFile: null,
    size: DEFAULT_LOGO_SIZE,
    x: DEFAULT_LOGO_X,
    y: DEFAULT_LOGO_Y,
  });
});

test('button reset helper returns canonical default state', () => {
  assert.deepEqual(createDefaultButtonState(), {
    type: DEFAULT_BUTTON_TYPE,
    text: DEFAULT_BUTTON_TEXT,
    image: null,
    imageFile: null,
    size: DEFAULT_BUTTON_SIZE,
    x: DEFAULT_BUTTON_X,
    y: DEFAULT_BUTTON_Y,
  });
});

test('buildRenderSpec receives default reset values unchanged', () => {
  const logo = createDefaultLogoState();
  const button = createDefaultButtonState();

  const spec = buildRenderSpec({
    inputRatio: '16:9',
    outputRatio: '9:16',
    duration: 30,
    fgPosition: 'right',
    bgType: 'video',
    blurAmount: 24,
    logoX: logo.x,
    logoY: logo.y,
    logoSize: logo.size,
    buttonType: button.type,
    buttonText: button.text,
    buttonX: button.x,
    buttonY: button.y,
    buttonSize: button.size,
    gameName: 'Game',
    version: 'v1',
    suffix: 'A',
  });

  assert.equal(spec.logoX, DEFAULT_LOGO_X);
  assert.equal(spec.logoY, DEFAULT_LOGO_Y);
  assert.equal(spec.logoSize, DEFAULT_LOGO_SIZE);
  assert.equal(spec.buttonType, DEFAULT_BUTTON_TYPE);
  assert.equal(spec.buttonText, DEFAULT_BUTTON_TEXT);
  assert.equal(spec.buttonX, DEFAULT_BUTTON_X);
  assert.equal(spec.buttonY, DEFAULT_BUTTON_Y);
  assert.equal(spec.buttonSize, DEFAULT_BUTTON_SIZE);
});
