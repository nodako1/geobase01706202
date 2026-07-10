import {Composition} from 'remotion';
import preparedData from './generated/video-data.json';
import {GeoBaseVideoV4} from './GeoBaseVideoV4';
import type {PreparedVideoData} from './types';

const data = preparedData as PreparedVideoData;
const {config, years} = data;

const introFrames = Math.round(config.introSeconds * config.fps);
const periodFrames = Math.max(
  1,
  Math.round((config.secondsPerPeriod ?? config.secondsPerYear) * config.fps),
);
const intervalCount = Math.max(1, years.length - 1);
const outroFrames = Math.round(config.outroSeconds * config.fps);
const durationInFrames = Math.max(
  1,
  introFrames + intervalCount * periodFrames + outroFrames,
);

export const RemotionRoot = () => {
  return (
    <Composition
      id="GeoBase"
      component={GeoBaseVideoV4}
      durationInFrames={durationInFrames}
      fps={config.fps}
      width={config.outputWidth}
      height={config.outputHeight}
    />
  );
};
