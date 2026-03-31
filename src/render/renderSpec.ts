import { buildOutputFilename } from '../naming';
import { RenderSpec } from '../../shared/render-contract';

type BuilderInput = {
  inputRatio: RenderSpec['inputRatio'];
  outputRatio: RenderSpec['outputRatio'];
  duration?: number;
  fgPosition: RenderSpec['fgPosition'];
  bgType: RenderSpec['bgType'];
  blurAmount: number;
  logoX: number;
  logoY: number;
  logoSize: number;
  buttonType: RenderSpec['buttonType'];
  buttonText?: string;
  buttonX: number;
  buttonY: number;
  buttonSize: number;
  gameName: string;
  version: string;
  suffix: string;
};

export const buildRenderSpec = (input: BuilderInput): RenderSpec => {
  const naming = {
    gameName: input.gameName || 'untitled',
    version: input.version || 'v1',
    suffix: input.suffix,
  };

  return {
    inputRatio: input.inputRatio,
    outputRatio: input.outputRatio,
    duration: input.duration,
    fgPosition: input.fgPosition,
    bgType: input.bgType,
    blurAmount: input.blurAmount,
    logoX: input.logoX,
    logoY: input.logoY,
    logoSize: input.logoSize,
    buttonType: input.buttonType,
    buttonText: input.buttonText,
    buttonX: input.buttonX,
    buttonY: input.buttonY,
    buttonSize: input.buttonSize,
    naming,
    outputFilename: buildOutputFilename(naming, input.outputRatio, input.duration),
  };
};
