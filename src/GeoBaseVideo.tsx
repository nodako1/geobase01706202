import {geoGraticule10, geoNaturalEarth1, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import worldAtlas from 'world-atlas/countries-50m.json';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import preparedData from './generated/video-data.json';
import type {CountryWinner, PreparedVideoData, RankingRow, YearSnapshot} from './types';

const data = preparedData as PreparedVideoData;
const topology = worldAtlas as unknown as {objects: {countries: unknown}};
const world = feature(
  worldAtlas as never,
  topology.objects.countries as never,
) as unknown as {features: Array<{id?: string | number}>};

const projection = geoNaturalEarth1().fitExtent(
  [
    [22, 20],
    [1058, 690],
  ],
  world as never,
);
const mapPath = geoPath(projection);
const graticulePath = mapPath(geoGraticule10() as never) ?? undefined;
const spherePath = mapPath({type: 'Sphere'} as never) ?? undefined;
const focusFeature = world.features.find(
  (country) => String(country.id ?? '').padStart(3, '0') === '392',
);
const focusPoint = focusFeature ? mapPath.centroid(focusFeature as never) : [878, 365];

const fontFamily =
  'Inter, "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';

const browserMark = (entity: string) => {
  const marks: Record<string, string> = {
    'Internet Explorer': 'IE',
    Firefox: 'Fx',
    Chrome: 'C',
    Safari: 'S',
    'Opera Mini': 'O',
    'UC Browser': 'UC',
    Edge: 'E',
  };
  return marks[entity] ?? entity.slice(0, 2);
};

const countryFor = (snapshot: YearSnapshot, countryCode?: string) =>
  countryCode
    ? snapshot.countries.find((country) => country.countryCode === countryCode)
    : undefined;

const rankingFor = (snapshot: YearSnapshot, entity: string) =>
  snapshot.ranking.find((row) => row.entity === entity)?.count ?? 0;

const browserBadge = (entityName: string, size: number) => {
  const entity = data.entities[entityName];
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: size * 0.32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(145deg, ${entity.color}, ${entity.color}B8)`,
        color: '#FFFFFF',
        fontSize: size * (entityName === 'UC Browser' ? 0.29 : 0.38),
        fontWeight: 950,
        letterSpacing: -1,
        border: '2px solid rgba(255,255,255,0.5)',
        boxShadow: `0 0 ${size * 0.42}px ${entity.color}77`,
      }}
    >
      {browserMark(entityName)}
    </div>
  );
};

const MapLayer = ({
  snapshot,
  opacity,
  emphasizeChanges,
  pulse,
}: {
  snapshot: YearSnapshot;
  opacity: number;
  emphasizeChanges: boolean;
  pulse: number;
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
        const changed = Boolean(winner?.changed && emphasizeChanges);
        return (
          <path
            key={`${numericCode}-${index}`}
            d={mapPath(country as never) ?? undefined}
            fill={entity?.color ?? data.config.noDataColor}
            fillOpacity={winner ? 0.94 : 0.72}
            stroke={changed ? '#FFFFFF' : 'rgba(205,222,241,0.54)'}
            strokeWidth={changed ? 1.8 + pulse * 1.8 : 0.65}
            strokeLinejoin="round"
            style={{
              filter: changed
                ? `drop-shadow(0 0 ${7 + pulse * 13}px ${entity?.color ?? '#FFFFFF'})`
                : 'drop-shadow(0 1px 1px rgba(0,0,0,0.42))',
            }}
          />
        );
      })}
    </g>
  );
};

const WorldMap = ({
  current,
  next,
  transition,
  phase,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  transition: number;
  phase: number;
}) => {
  const shown = transition >= 0.5 ? next : current;
  const pulse = (Math.sin(phase * Math.PI * 4) + 1) / 2;
  const focus = countryFor(shown, data.config.focusCountryCode);
  const focusEntity = focus ? data.entities[focus.entity] : null;

  return (
    <div
      style={{
        position: 'relative',
        height: 715,
        borderRadius: 38,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 52% 45%, rgba(29,73,112,0.75), rgba(4,13,24,0.97) 68%)',
        border: '1px solid rgba(181,218,255,0.20)',
        boxShadow:
          'inset 0 0 90px rgba(35,111,171,0.18), 0 22px 55px rgba(0,0,0,0.36)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.22,
          backgroundImage:
            'linear-gradient(rgba(92,165,217,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(92,165,217,0.13) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />
      <svg viewBox="0 0 1080 715" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        <path d={spherePath} fill="#071624" stroke="rgba(124,188,231,0.42)" strokeWidth={1.2} />
        <path d={graticulePath} fill="none" stroke="rgba(128,183,220,0.15)" strokeWidth={0.65} />
        <MapLayer snapshot={current} opacity={1 - transition} emphasizeChanges={false} pulse={pulse} />
        <MapLayer snapshot={next} opacity={transition} emphasizeChanges={transition > 0.24} pulse={pulse} />
        {focusEntity ? (
          <g>
            <circle
              cx={focusPoint[0]}
              cy={focusPoint[1]}
              r={8 + pulse * 5}
              fill="#FFFFFF"
              stroke={focusEntity.color}
              strokeWidth={5}
              style={{filter: `drop-shadow(0 0 14px ${focusEntity.color})`}}
            />
            <path
              d={`M${focusPoint[0] + 10},${focusPoint[1] - 9} L${focusPoint[0] + 45},${focusPoint[1] - 38}`}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            <rect
              x={focusPoint[0] + 42}
              y={focusPoint[1] - 66}
              width={124}
              height={42}
              rx={14}
              fill="rgba(3,10,18,0.88)"
              stroke={focusEntity.color}
            />
            <text
              x={focusPoint[0] + 104}
              y={focusPoint[1] - 38}
              fill="#FFFFFF"
              textAnchor="middle"
              fontSize={23}
              fontWeight={900}
              fontFamily={fontFamily}
            >
              日本
            </text>
          </g>
        ) : null}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 22,
          top: 18,
          padding: '9px 14px',
          borderRadius: 14,
          background: 'rgba(2,8,15,0.70)',
          color: '#9CB3C9',
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        色＝その国で利用率1位
      </div>
    </div>
  );
};

const Ranking = ({snapshot, reveal}: {snapshot: YearSnapshot; reveal: number}) => {
  const visible = snapshot.ranking
    .filter((row) => row.count > 0)
    .slice(0, data.config.rankingSize);
  const maxCount = Math.max(1, visible[0]?.count ?? 1);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
      {visible.map((row, index) => {
        const entity = data.entities[row.entity];
        const delay = index * 0.055;
        const itemReveal = interpolate(reveal, [delay, delay + 0.48], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div
            key={row.entity}
            style={{
              position: 'relative',
              height: 76,
              borderRadius: 22,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '54px 54px 1fr 128px',
              alignItems: 'center',
              gap: 12,
              padding: '0 20px',
              transform: `translateX(${(1 - itemReveal) * 42}px)`,
              opacity: itemReveal,
              background: row.rank === 1 ? 'rgba(255,255,255,0.125)' : 'rgba(255,255,255,0.055)',
              border: row.rank === 1 ? `1.5px solid ${entity.color}BB` : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${(row.count / maxCount) * 100 * itemReveal}%`,
                background: `linear-gradient(90deg, ${entity.color}40, ${entity.color}08)`,
              }}
            />
            <div style={{zIndex: 1, fontSize: 27, fontWeight: 950, color: row.rank === 1 ? '#FFFFFF' : '#AFC0D3'}}>
              {row.rank}
            </div>
            <div style={{zIndex: 1}}>{browserBadge(row.entity, 42)}</div>
            <div style={{zIndex: 1, fontSize: 27, fontWeight: 900, whiteSpace: 'nowrap'}}>{entity.displayName}</div>
            <div style={{zIndex: 1, textAlign: 'right'}}>
              <span style={{fontSize: 34, fontWeight: 950}}>{row.count}</span>
              <span style={{fontSize: 18, marginLeft: 5, color: '#AFC0D3'}}>か国</span>
              {data.config.showDelta && row.delta !== 0 ? (
                <span
                  style={{
                    marginLeft: 7,
                    fontSize: 18,
                    fontWeight: 900,
                    color: row.delta > 0 ? '#6BF0AF' : '#FF8597',
                  }}
                >
                  {row.delta > 0 ? '+' : ''}{row.delta}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FocusCard = ({snapshot}: {snapshot: YearSnapshot}) => {
  const focus = countryFor(snapshot, data.config.focusCountryCode);
  if (!focus) return null;
  const entity = data.entities[focus.entity];
  return (
    <div
      style={{
        marginTop: 13,
        height: 86,
        borderRadius: 23,
        display: 'grid',
        gridTemplateColumns: '118px 54px 1fr auto',
        alignItems: 'center',
        gap: 13,
        padding: '0 20px',
        background: `linear-gradient(90deg, ${entity.color}30, rgba(255,255,255,0.055))`,
        border: `1px solid ${entity.color}99`,
      }}
    >
      <div style={{fontSize: 25, fontWeight: 950}}>🇯🇵 {data.config.focusCountryLabel ?? '日本'}</div>
      {browserBadge(focus.entity, 43)}
      <div>
        <div style={{fontSize: 28, fontWeight: 950}}>{entity.displayName}</div>
        <div style={{fontSize: 17, color: '#ABC0D5'}}>国内利用率1位</div>
      </div>
      <div style={{fontSize: 35, fontWeight: 950, color: entity.color}}>{focus.value.toFixed(1)}%</div>
    </div>
  );
};

const EventBanner = ({snapshot, phase}: {snapshot: YearSnapshot; phase: number}) => {
  const event = data.config.showEvents ? snapshot.events[0] : undefined;
  if (!event) return null;
  const show = interpolate(phase, [0, 0.12, 0.82, 1], [0, 1, 1, 0.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leader = snapshot.leader ? data.entities[snapshot.leader] : null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 28,
        right: 28,
        bottom: 24,
        minHeight: 96,
        borderRadius: 24,
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: show,
        transform: `translateY(${(1 - show) * 24}px)`,
        background: 'linear-gradient(90deg, rgba(3,9,16,0.94), rgba(10,25,39,0.91))',
        border: `1px solid ${leader?.color ?? '#FFCF66'}AA`,
        boxShadow: `0 0 28px ${leader?.color ?? '#FFCF66'}33`,
      }}
    >
      <div style={{fontSize: 35}}>⚡</div>
      <div>
        <div style={{fontSize: 28, fontWeight: 950}}>{event.title}</div>
        <div style={{marginTop: 3, fontSize: 20, color: '#C4D1DF', fontWeight: 650}}>{event.description}</div>
      </div>
    </div>
  );
};

const Progress = ({year}: {year: number}) => {
  const ratio = (year - data.config.startYear) / Math.max(1, data.config.endYear - data.config.startYear);
  return (
    <div style={{marginTop: 15}}>
      <div style={{height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden'}}>
        <div
          style={{
            height: '100%',
            width: `${ratio * 100}%`,
            borderRadius: 999,
            background: 'linear-gradient(90deg, #39A9F5, #34A853, #FFB000)',
            boxShadow: '0 0 14px rgba(81,199,255,0.65)',
          }}
        />
      </div>
      <div style={{marginTop: 7, display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#7F96AC', fontWeight: 800}}>
        <span>{data.config.startYear}</span>
        <span>{data.config.sourceLabel}</span>
        <span>{data.config.endYear}</span>
      </div>
    </div>
  );
};

const MainScene = ({
  current,
  next,
  transition,
  phase,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  transition: number;
  phase: number;
}) => {
  const shown = transition >= 0.5 ? next : current;
  const leader = shown.leader ? data.entities[shown.leader] : null;
  const changedCount = Object.values(shown.gainedByEntity).reduce((sum, value) => sum + value, 0);
  const rankingReveal = interpolate(phase, [0.02, 0.48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '46px 48px 34px',
        background: `radial-gradient(circle at 50% 28%, #102B43 0%, ${data.config.backgroundColor} 55%, #020408 100%)`,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <div style={{fontSize: 41, fontWeight: 950, letterSpacing: 0.5}}>{data.config.title}</div>
          <div style={{marginTop: 5, fontSize: 21, color: '#AFC0D3', fontWeight: 750}}>
            {data.config.subtitle}　<span style={{color: '#6FBDEB'}}>{data.config.metricLabel}</span>
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: 83, lineHeight: 0.92, fontWeight: 950, letterSpacing: -4}}>{shown.year}</div>
          <div style={{marginTop: 8, fontSize: 18, color: changedCount ? '#FFD277' : '#7F96AC', fontWeight: 850}}>
            {changedCount ? `${changedCount}か国で勢力交代` : '勢力図を集計中'}
          </div>
        </div>
      </div>

      <div style={{position: 'relative', marginTop: 22}}>
        <WorldMap current={current} next={next} transition={transition} phase={phase} />
        <EventBanner snapshot={shown} phase={phase} />
        {shown.leaderChanged && leader ? (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '11px 25px',
              borderRadius: 999,
              background: leader.color,
              color: '#041019',
              fontSize: 24,
              fontWeight: 950,
              boxShadow: `0 0 30px ${leader.color}`,
            }}
          >
            👑 世界首位交代　{leader.displayName}
          </div>
        ) : null}
      </div>

      <div style={{marginTop: 18}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10}}>
          <div style={{fontSize: 22, fontWeight: 900, color: '#AFC0D3'}}>支配国数ランキング</div>
          <div style={{fontSize: 18, color: leader?.color ?? '#AFC0D3', fontWeight: 900}}>
            首位：{leader?.displayName ?? 'データなし'}
          </div>
        </div>
        <Ranking snapshot={shown} reveal={rankingReveal} />
        <FocusCard snapshot={shown} />
        <Progress year={shown.year} />
      </div>
    </AbsoluteFill>
  );
};

const Intro = ({frame, fps}: {frame: number; fps: number}) => {
  const entrance = spring({frame, fps, config: {damping: 15, stiffness: 105, mass: 0.8}});
  const marks = ['Internet Explorer', 'Firefox', 'Chrome', 'Safari', 'Opera Mini', 'UC Browser'];
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 62,
        color: '#FFFFFF',
        textAlign: 'center',
        fontFamily,
        background: `radial-gradient(circle at center, #153E5E 0%, ${data.config.backgroundColor} 62%, #010307 100%)`,
      }}
    >
      <div style={{fontSize: 24, color: '#77CFFF', fontWeight: 950, letterSpacing: 5}}>BROWSER WARS</div>
      <div
        style={{
          marginTop: 28,
          fontSize: 68,
          lineHeight: 1.24,
          fontWeight: 950,
          whiteSpace: 'pre-line',
          transform: `scale(${0.84 + entrance * 0.16})`,
          textShadow: '0 0 32px rgba(82,190,255,0.25)',
        }}
      >
        {data.config.hookText ?? data.config.title}
      </div>
      <div style={{marginTop: 44, display: 'flex', gap: 18, justifyContent: 'center'}}>
        {marks.map((mark, index) => {
          const item = spring({frame: frame - index * 3, fps, config: {damping: 14, stiffness: 130}});
          return <div key={mark} style={{transform: `translateY(${(1 - item) * 40}px) scale(${item})`, opacity: item}}>{browserBadge(mark, 76)}</div>;
        })}
      </div>
      <div style={{marginTop: 48, fontSize: 37, fontWeight: 900}}>
        {data.config.startYear} <span style={{color: '#6ABDEB'}}>→</span> {data.config.endYear}
      </div>
      <div style={{marginTop: 18, fontSize: 24, color: '#AFC0D3', fontWeight: 750}}>
        世界の色が、わずか数年で塗り替わる
      </div>
    </AbsoluteFill>
  );
};

const SummaryCard = ({
  entity,
  before,
  after,
}: {
  entity: string;
  before: number;
  after: number;
}) => {
  const config = data.entities[entity];
  return (
    <div
      style={{
        flex: 1,
        padding: '21px 20px',
        borderRadius: 24,
        background: `linear-gradient(145deg, ${config.color}28, rgba(255,255,255,0.05))`,
        border: `1px solid ${config.color}88`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        {browserBadge(entity, 45)}
        <div style={{fontSize: 24, fontWeight: 950}}>{config.displayName}</div>
      </div>
      <div style={{marginTop: 16, fontSize: 28, fontWeight: 950}}>
        {before}か国 <span style={{color: '#8298AD'}}>→</span> <span style={{color: config.color}}>{after}か国</span>
      </div>
    </div>
  );
};

const Outro = ({frame, startFrame, fps}: {frame: number; startFrame: number; fps: number}) => {
  const local = frame - startFrame;
  const reveal = spring({frame: local, fps, config: {damping: 17, stiffness: 105}});
  const first = data.years[0];
  const last = data.years[data.years.length - 1];
  const focus = countryFor(last, data.config.focusCountryCode);
  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '50px 50px 38px',
        background: `radial-gradient(circle at 50% 30%, #12314B, ${data.config.backgroundColor} 62%, #010307)`,
      }}
    >
      <div style={{textAlign: 'center', transform: `translateY(${(1 - reveal) * 28}px)`, opacity: reveal}}>
        <div style={{fontSize: 25, color: '#76CDFF', fontWeight: 950, letterSpacing: 3}}>FINAL RESULT</div>
        <div style={{marginTop: 9, fontSize: 54, fontWeight: 950}}>16年で世界はこう変わった</div>
      </div>
      <div style={{marginTop: 26}}>
        <WorldMap current={last} next={last} transition={0} phase={0.7} />
      </div>
      <div style={{marginTop: 20, display: 'flex', gap: 14}}>
        <SummaryCard entity="Internet Explorer" before={rankingFor(first, 'Internet Explorer')} after={rankingFor(last, 'Internet Explorer')} />
        <SummaryCard entity="Chrome" before={rankingFor(first, 'Chrome')} after={rankingFor(last, 'Chrome')} />
      </div>
      {focus ? (
        <div style={{marginTop: 16, textAlign: 'center', fontSize: 28, fontWeight: 900}}>
          🇯🇵 日本の最終首位は <span style={{color: data.entities[focus.entity].color}}>{focus.entity}</span>
        </div>
      ) : null}
      <div style={{marginTop: 28, textAlign: 'center'}}>
        <div style={{fontSize: 31, fontWeight: 950}}>{data.config.endingQuestion}</div>
        <div style={{marginTop: 18, display: 'flex', justifyContent: 'center', gap: 18}}>
          {[data.config.endingOptionA, data.config.endingOptionB].filter(Boolean).map((option) => (
            <div
              key={option}
              style={{
                minWidth: 230,
                padding: '15px 26px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.20)',
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              {option}
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 22, left: 40, right: 40, textAlign: 'center', fontSize: 15, color: '#71879C'}}>
        {data.config.sourceLabel}｜市場シェアはアクセス数ベースの推計で、人口比ではありません
      </div>
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

  if (frame < introFrames) return <Intro frame={frame} fps={fps} />;
  if (frame >= outroStart) return <Outro frame={frame} startFrame={outroStart} fps={fps} />;

  const relativeFrame = Math.max(0, frame - mainStart);
  const index = Math.min(years.length - 1, Math.floor(relativeFrame / yearFrames));
  const current = years[index];
  const next = years[Math.min(years.length - 1, index + 1)];
  const phase = (relativeFrame % yearFrames) / yearFrames;
  const transitionStart = Math.max(0, 1 - config.transitionRatio);
  const transition = interpolate(phase, [transitionStart, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  return <MainScene current={current} next={next} transition={transition} phase={phase} />;
};
