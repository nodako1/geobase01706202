import {geoNaturalEarth1, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import preparedData from './generated/video-data.json';
import type {PreparedVideoData, YearSnapshot} from './types';

const data = preparedData as PreparedVideoData;
const topology = worldAtlas as unknown as {objects: {countries: unknown}};
const world = feature(
  worldAtlas as never,
  topology.objects.countries as never,
) as unknown as {features: Array<{id?: string | number}>};
const projection = geoNaturalEarth1().fitExtent(
  [
    [35, 30],
    [1045, 730],
  ],
  world as never,
);
const path = geoPath(projection);

const fontFamily =
  'Inter, "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';

const MapLayer = ({
  snapshot,
  opacity,
}: {
  snapshot: YearSnapshot;
  opacity: number;
}) => {
  const winners = new Map(
    snapshot.countries.map((country) => [country.numericCode, country]),
  );

  return (
    <g opacity={opacity}>
      {world.features.map((country, index) => {
        const numericCode = String(country.id ?? '').padStart(3, '0');
        const winner = winners.get(numericCode);
        const entity = winner ? data.entities[winner.entity] : null;
        const fill = entity?.color ?? data.config.noDataColor;
        const changed = winner?.changed ?? false;

        return (
          <path
            key={`${numericCode}-${index}`}
            d={path(country as never) ?? undefined}
            fill={fill}
            stroke={changed ? '#FFFFFF' : '#8191A8'}
            strokeWidth={changed ? 2.8 : 0.75}
            style={{
              filter: changed
                ? `drop-shadow(0 0 8px ${entity?.color ?? '#FFFFFF'})`
                : undefined,
            }}
          />
        );
      })}
    </g>
  );
};

const Ranking = ({snapshot}: {snapshot: YearSnapshot}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {snapshot.ranking.slice(0, data.config.rankingSize).map((row) => {
        const entity = data.entities[row.entity];
        return (
          <div
            key={row.entity}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr auto',
              alignItems: 'center',
              gap: 18,
              padding: '18px 22px',
              borderRadius: 22,
              background:
                row.rank === 1
                  ? 'linear-gradient(90deg, rgba(255,255,255,0.17), rgba(255,255,255,0.06))'
                  : 'rgba(255,255,255,0.065)',
              border:
                row.rank === 1
                  ? `2px solid ${entity.color}`
                  : '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div style={{fontSize: 36, fontWeight: 900}}>#{row.rank}</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  backgroundColor: entity.color,
                  boxShadow: `0 0 16px ${entity.color}`,
                }}
              />
              <div style={{fontSize: 34, fontWeight: 800}}>
                {entity.displayName}
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
              <strong style={{fontSize: 44}}>{row.count}</strong>
              <span style={{fontSize: 24, color: '#B7C5D8'}}>か国</span>
              {data.config.showDelta && row.delta !== 0 ? (
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: row.delta > 0 ? '#63F0AE' : '#FF8A9A',
                  }}
                >
                  {row.delta > 0 ? '+' : ''}
                  {row.delta}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MainScene = ({
  current,
  next,
  transition,
  isOutro,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  transition: number;
  isOutro: boolean;
}) => {
  const shown = transition >= 0.5 ? next : current;
  const leader = shown.leader ? data.entities[shown.leader] : null;
  const event = data.config.showEvents ? shown.events[0] : undefined;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 36%, #142B47 0%, ${data.config.backgroundColor} 58%, #02070D 100%)`,
        color: '#FFFFFF',
        fontFamily,
        padding: '72px 58px 64px',
      }}
    >
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 50, fontWeight: 900, letterSpacing: 1}}>
          {data.config.title}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 27,
            color: '#AFC0D6',
            fontWeight: 700,
          }}
        >
          {data.config.subtitle}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 112,
            lineHeight: 1,
            fontWeight: 950,
            letterSpacing: -4,
            textShadow: '0 0 30px rgba(87,190,255,0.40)',
          }}
        >
          {shown.year}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 770,
          marginTop: 28,
          borderRadius: 36,
          overflow: 'hidden',
          background: 'rgba(4,12,23,0.58)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: 'inset 0 0 70px rgba(35,111,171,0.12)',
        }}
      >
        <svg viewBox="0 0 1080 760" style={{width: '100%', height: '100%'}}>
          <MapLayer snapshot={current} opacity={1 - transition} />
          <MapLayer snapshot={next} opacity={transition} />
        </svg>

        {shown.leaderChanged && leader ? (
          <div
            style={{
              position: 'absolute',
              top: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '14px 30px',
              borderRadius: 999,
              backgroundColor: leader.color,
              color: '#07111F',
              fontSize: 30,
              fontWeight: 950,
              boxShadow: `0 0 30px ${leader.color}`,
            }}
          >
            首位交代：{leader.displayName}
          </div>
        ) : null}
      </div>

      {event ? (
        <div
          style={{
            marginTop: 24,
            padding: '20px 28px',
            borderRadius: 24,
            background: 'linear-gradient(90deg, rgba(255,176,46,0.22), rgba(255,255,255,0.07))',
            border: '1px solid rgba(255,190,80,0.45)',
          }}
        >
          <div style={{fontSize: 30, fontWeight: 950}}>{event.title}</div>
          <div style={{marginTop: 5, fontSize: 24, color: '#D7DFEA'}}>
            {event.description}
          </div>
        </div>
      ) : null}

      <div style={{marginTop: event ? 24 : 34}}>
        <Ranking snapshot={shown} />
      </div>

      {isOutro ? (
        <div
          style={{
            position: 'absolute',
            left: 58,
            right: 58,
            bottom: 42,
            textAlign: 'center',
            fontSize: 30,
            fontWeight: 850,
            color: '#DCE7F5',
          }}
        >
          最終結果　最大勢力：{leader?.displayName ?? 'データなし'}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const GeoBaseVideo = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {config, years} = data;
  const introFrames = Math.round(config.introSeconds * fps);
  const yearFrames = Math.max(1, Math.round(config.secondsPerYear * fps));
  const mainFrames = years.length * yearFrames;
  const mainStart = introFrames;
  const outroStart = mainStart + mainFrames;

  if (frame < introFrames) {
    const entrance = spring({frame, fps, config: {damping: 16, stiffness: 110}});
    const opacity = interpolate(frame, [0, Math.max(1, introFrames * 0.2)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          textAlign: 'center',
          color: '#FFFFFF',
          fontFamily,
          background: `radial-gradient(circle at center, #183A5E 0%, ${config.backgroundColor} 58%, #02070D 100%)`,
        }}
      >
        <div style={{opacity, transform: `scale(${0.86 + entrance * 0.14})`}}>
          <div style={{fontSize: 76, fontWeight: 950, lineHeight: 1.2}}>
            {config.title}
          </div>
          <div
            style={{
              marginTop: 30,
              fontSize: 36,
              color: '#BFD1E6',
              fontWeight: 750,
            }}
          >
            {config.startYear} → {config.endYear}
          </div>
          <div
            style={{
              marginTop: 52,
              fontSize: 30,
              color: '#72CFFF',
              fontWeight: 850,
            }}
          >
            世界の勢力図はどう変わった？
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (frame >= outroStart) {
    const last = years[years.length - 1];
    return <MainScene current={last} next={last} transition={0} isOutro />;
  }

  const relativeFrame = Math.max(0, frame - mainStart);
  const index = Math.min(years.length - 1, Math.floor(relativeFrame / yearFrames));
  const current = years[index];
  const next = years[Math.min(years.length - 1, index + 1)];
  const phase = (relativeFrame % yearFrames) / yearFrames;
  const transitionStart = Math.max(0, 1 - config.transitionRatio);
  const transition = interpolate(phase, [transitionStart, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <MainScene
      current={current}
      next={next}
      transition={transition}
      isOutro={false}
    />
  );
};
