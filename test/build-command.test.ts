import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFfmpegCommand } from '../server/ffmpeg/buildCommand.ts';

test('clean mode 4:5 uses standard crop filter', () => {
  const args = buildFfmpegCommand({
    spec: {
      inputRatio: '16:9',
      outputRatio: '4:5',
      duration: 30,
      fgPosition: 'right',
      bgType: 'image',
      backgroundImageMode: 'clean',
      blurAmount: 24,
      logoX: 0,
      logoY: 0,
      logoSize: 100,
      buttonType: 'text',
      buttonText: 'Play Now',
      buttonX: 0,
      buttonY: 0,
      buttonSize: 100,
      naming: { gameName: 'Game', version: 'v1', suffix: 'A' },
      outputFilename: 'output.mp4',
    },
    foregroundPath: '/input/fg.mp4',
    backgroundImagePath: '/input/bg.jpg',
    outputPath: '/output/result.mp4',
  });

  const filterComplex = args.find(arg => arg.startsWith('['));
  assert.ok(filterComplex.includes('crop=1080:1350'), 'clean mode 4:5 should use standard crop');
  assert.ok(!filterComplex.includes('scale=3240:4050'), 'clean mode should not apply 3x scale');
});

test('clean mode 1:1 uses standard crop filter', () => {
  const args = buildFfmpegCommand({
    spec: {
      inputRatio: '16:9',
      outputRatio: '1:1',
      duration: 30,
      fgPosition: 'right',
      bgType: 'image',
      backgroundImageMode: 'clean',
      blurAmount: 24,
      logoX: 0,
      logoY: 0,
      logoSize: 100,
      buttonType: 'text',
      buttonText: 'Play Now',
      buttonX: 0,
      buttonY: 0,
      buttonSize: 100,
      naming: { gameName: 'Game', version: 'v1', suffix: 'A' },
      outputFilename: 'output.mp4',
    },
    foregroundPath: '/input/fg.mp4',
    backgroundImagePath: '/input/bg.jpg',
    outputPath: '/output/result.mp4',
  });

  const filterComplex = args.find(arg => arg.startsWith('['));
  assert.ok(filterComplex.includes('crop=1080:1080'), 'clean mode 1:1 should use standard crop');
  assert.ok(!filterComplex.includes('scale=3240:3240'), 'clean mode should not apply 3x scale');
});

test('precomposed mode 4:5 applies 3x scale with lower-center crop', () => {
  const args = buildFfmpegCommand({
    spec: {
      inputRatio: '16:9',
      outputRatio: '4:5',
      duration: 30,
      fgPosition: 'right',
      bgType: 'image',
      backgroundImageMode: 'precomposed',
      blurAmount: 24,
      logoX: 0,
      logoY: 0,
      logoSize: 100,
      buttonType: 'text',
      buttonText: 'Play Now',
      buttonX: 0,
      buttonY: 0,
      buttonSize: 100,
      naming: { gameName: 'Game', version: 'v1', suffix: 'A' },
      outputFilename: 'output.mp4',
    },
    foregroundPath: '/input/fg.mp4',
    backgroundImagePath: '/input/bg.jpg',
    outputPath: '/output/result.mp4',
  });

  const filterComplex = args.find(arg => arg.startsWith('['));
  assert.ok(filterComplex.includes('scale=3240:4050'), 'precomposed mode 4:5 should scale 3x');
  assert.ok(filterComplex.includes('crop=1080:1350:1080:2700'), 'precomposed mode 4:5 should crop from lower-center');
});

test('precomposed mode 1:1 applies 3x scale with lower-center crop', () => {
  const args = buildFfmpegCommand({
    spec: {
      inputRatio: '16:9',
      outputRatio: '1:1',
      duration: 30,
      fgPosition: 'right',
      bgType: 'image',
      backgroundImageMode: 'precomposed',
      blurAmount: 24,
      logoX: 0,
      logoY: 0,
      logoSize: 100,
      buttonType: 'text',
      buttonText: 'Play Now',
      buttonX: 0,
      buttonY: 0,
      buttonSize: 100,
      naming: { gameName: 'Game', version: 'v1', suffix: 'A' },
      outputFilename: 'output.mp4',
    },
    foregroundPath: '/input/fg.mp4',
    backgroundImagePath: '/input/bg.jpg',
    outputPath: '/output/result.mp4',
  });

  const filterComplex = args.find(arg => arg.startsWith('['));
  assert.ok(filterComplex.includes('scale=3240:3240'), 'precomposed mode 1:1 should scale 3x');
  assert.ok(filterComplex.includes('crop=1080:1080:1080:2160'), 'precomposed mode 1:1 should crop from lower-center');
});

test('precomposed mode 9:16 keeps existing behavior', () => {
  const args = buildFfmpegCommand({
    spec: {
      inputRatio: '16:9',
      outputRatio: '9:16',
      duration: 30,
      fgPosition: 'right',
      bgType: 'image',
      backgroundImageMode: 'precomposed',
      blurAmount: 24,
      logoX: 0,
      logoY: 0,
      logoSize: 100,
      buttonType: 'text',
      buttonText: 'Play Now',
      buttonX: 0,
      buttonY: 0,
      buttonSize: 100,
      naming: { gameName: 'Game', version: 'v1', suffix: 'A' },
      outputFilename: 'output.mp4',
    },
    foregroundPath: '/input/fg.mp4',
    backgroundImagePath: '/input/bg.jpg',
    outputPath: '/output/result.mp4',
  });

  const filterComplex = args.find(arg => arg.startsWith('['));
  assert.ok(!filterComplex.includes('scale=3240'), 'precomposed mode 9:16 should not apply 3x scale');
  assert.ok(!filterComplex.includes('crop=1080:1920:1080'), 'precomposed mode 9:16 should not apply lower-center crop');
});

test('precomposed mode 16:9 keeps existing behavior', () => {
  const args = buildFfmpegCommand({
    spec: {
      inputRatio: '16:9',
      outputRatio: '16:9',
      duration: 30,
      fgPosition: 'right',
      bgType: 'image',
      backgroundImageMode: 'precomposed',
      blurAmount: 24,
      logoX: 0,
      logoY: 0,
      logoSize: 100,
      buttonType: 'text',
      buttonText: 'Play Now',
      buttonX: 0,
      buttonY: 0,
      buttonSize: 100,
      naming: { gameName: 'Game', version: 'v1', suffix: 'A' },
      outputFilename: 'output.mp4',
    },
    foregroundPath: '/input/fg.mp4',
    backgroundImagePath: '/input/bg.jpg',
    outputPath: '/output/result.mp4',
  });

  const filterComplex = args.find(arg => arg.startsWith('['));
  assert.ok(!filterComplex.includes('scale=3240'), 'precomposed mode 16:9 should not apply 3x scale');
  assert.ok(!filterComplex.includes('crop=1920:1080:1920'), 'precomposed mode 16:9 should not apply lower-center crop');
});