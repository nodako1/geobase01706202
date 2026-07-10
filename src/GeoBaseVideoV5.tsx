import {geoGraticule10, geoMercator, geoNaturalEarth1, geoPath} from 'd3-geo';
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
import type {
  BrowserShare,
  CountryWinner,
  PreparedVideoData,
  RankingRow,
  YearSnapshot,
} from './types';

const data = preparedData as PreparedVideoData;
const topology = worldAtlas as unknown as {objects: {countries: unknown}};
const world = feature(
  worldAtlas as never,
  topology.objects.countries as never,
) as unknown as {features: Array<{id?: string | number}>};

const fontFamily =
  '"Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';
const entityOrder = Object.keys(data.entities).sort(
  (a, b) => data.entities[a].priority - data.entities[b].priority,
);
const centerLongitude = data.config.mapCenterLongitude ?? 150;

const worldProjection = geoNaturalEarth1()
  .rotate([-centerLongitude, 0])
  .fitExtent(
    [
      [18, 22],
      [1062, 792],
    ],
    world as never,
  );
const worldPath = geoPath(worldProjection);
const spherePath = worldPath({type: 'Sphere'} as never) ?? undefined;
const graticulePath = worldPath(geoGraticule10() as never) ?? undefined;

const pacificProjection = geoMercator()
  .center([150, 10])
  .scale(305)
  .translate([180, 126]);
const pacificPath = geoPath(pacificProjection);

const japanFeature = world.features.find(
  (country) => String(country.id ?? '').padStart(3, '0') === '392',
);
const japanPoint = japanFeature ? worldPath.centroid(japanFeature as never) : [540, 365];
const pacificJapanPoint = japanFeature
  ? pacificPath.centroid(japanFeature as never)
  : [180, 83];

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const entityMark = (entity: string) =>
  data.entities[entity]?.mark ?? entity.slice(0, 2);

const EntityBadge = ({
  entityName,
  size,
}: {
  entityName: string;
  size: number;
}) => {
  const entity = data.entities[entityName];
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: size * 0.31,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(145deg, ${entity.color}, ${entity.color}B8)`,
        color: '#FFFFFF',
        fontSize: size * (entityMark(entityName).length >= 2 ? 0.36 : 0.43),
        fontWeight: 900,
        border: '2px solid rgba(255,255,255,0.50)',
        boxShadow: `0 0 ${size * 0.35}px ${entity.color}66`,
      }}
    >
      {entityMark(entityName)}
    </div>
  );
};

const countryFor = (snapshot: YearSnapshot, numericCode: string) =>
  snapshot.countries.find((country) => country.numericCode === numericCode);

const shareValue = (country: CountryWinner | undefined, entity: string) =>
  country?.shares.find((share) => share.entity === entity)?.value ?? 0;

type InterpolatedCountry = {
  countryCode: string;
  numericCode: string;
  shares: BrowserShare[];
  rankedShares: BrowserShare[];
  leader: string;
  leaderShare: number;
  changingLeader: boolean;
};

const interpolateCountry = (
  current: CountryWinner | undefined,
  next: CountryWinner | undefined,
  progress: number,
): InterpolatedCountry | null => {
  const base = current ?? next;
  if (!base) return null;
  const shares = entityOrder.map((entity) => ({
    entity,
    value: mix(
      current ? shareValue(current, entity) : shareValue(next, entity),
      next ? shareValue(next, entity) : shareValue(current, entity),
      progress,
    ),
  }));
  const total = shares.reduce((sum, share) => sum + share.value, 0) || 1;
  const normalized = shares.map((share) => ({
    ...share,
    value: (share.value / total) * 100,
  }));
  const rankedShares = [...normalized].sort(
    (a, b) =>
      b.value - a.value ||
      data.entities[a.entity].priority - data.entities[b.entity].priority,
  );
  return {
    countryCode: base.countryCode,
    numericCode: base.numericCode,
    shares: normalized,
    rankedShares,
    leader: rankedShares[0].entity,
    leaderShare: rankedShares[0].value,
    changingLeader: Boolean(current && next && current.entity !== next.entity),
  };
};

const ShareStops = ({
  shares,
  idPrefix,
}: {
  shares: BrowserShare[];
  idPrefix: string;
}) => {
  let cursor = 0;
  const visible = shares.filter((share) => share.value >= 0.05);
  return (
    <>
      {visible.flatMap((share, index) => {
        const start = cursor;
        cursor += share.value;
        const end = index === visible.length - 1 ? 100 : cursor;
        const color = data.entities[share.entity].color;
        return [
          <stop
            key={`${idPrefix}-${share.entity}-start`}
            offset={`${start}%`}
            stopColor={color}
          />,
          <stop
            key={`${idPrefix}-${share.entity}-end`}
            offset={`${end}%`}
            stopColor={color}
          />,
        ];
      })}
    </>
  );
};

const buildRenderedCountries = (
  current: YearSnapshot,
  next: YearSnapshot,
  progress: number,
  pathBuilder: ReturnType<typeof geoPath>,
) =>
  world.features.map((country, index) => {
    const numericCode = String(country.id ?? '').padStart(3, '0');
    const path = pathBuilder(country as never) ?? undefined;
    const state = interpolateCountry(
      countryFor(current, numericCode),
      countryFor(next, numericCode),
      progress,
    );
    return {index, numericCode, path, state};
  });

const PacificInset = ({
  current,
  next,
  progress,
  pulse,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
  pulse: number;
}) => {
  const rendered = buildRenderedCountries(
    current,
    next,
    progress,
    pacificPath,
  );
  const focusEntity = data.config.focusFaction ?? 'Japan';
  const focusColor = data.entities[focusEntity]?.color ?? '#FFFFFF';

  return (
    <div
      style={{
        position: 'absolute',
        left: data.config.insetLeft ?? 560,
        top: data.config.insetTop ?? 390,
        width: 370,
        height: 258,
        borderRadius: 27,
        overflow: 'hidden',
        background:
          'linear-gradient(145deg, rgba(3,12,21,0.97), rgba(18,42,64,0.95))',
        border: `1.8px solid ${focusColor}AA`,
        boxShadow: `0 14px 34px rgba(0,0,0,0.42), 0 0 26px ${focusColor}33`,
        zIndex: 4,
      }}
    >
      <div
        style={{
          position: 'absolute',
          zIndex: 5,
          left: 16,
          top: 12,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        日本・太平洋戦線
      </div>
      <svg
        viewBox="0 0 360 250"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        <defs>
          <filter id="pacific-organic-v5" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.032"
              numOctaves="2"
              seed="31"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {rendered
            .filter((item) => item.state && item.path)
            .map((item) => (
              <linearGradient
                key={`pacific-gradient-${item.numericCode}`}
                id={`pacific-share-${item.numericCode}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <ShareStops
                  shares={item.state!.shares}
                  idPrefix={`pacific-${item.numericCode}`}
                />
              </linearGradient>
            ))}
        </defs>
        <rect width="360" height="250" fill="#061522" />
        {rendered.map((item) => {
          if (!item.path) return null;
          if (!item.state) {
            return (
              <path
                key={`pacific-empty-${item.numericCode}-${item.index}`}
                d={item.path}
                fill={data.config.noDataColor}
                stroke="rgba(204,222,239,0.30)"
                strokeWidth={0.5}
              />
            );
          }
          return (
            <path
              key={`pacific-country-${item.numericCode}-${item.index}`}
              d={item.path}
              fill={`url(#pacific-share-${item.numericCode})`}
              stroke="rgba(235,244,252,0.65)"
              strokeWidth={0.72}
              filter="url(#pacific-organic-v5)"
            />
          );
        })}
        <circle
          cx={pacificJapanPoint[0]}
          cy={pacificJapanPoint[1]}
          r={5 + pulse * 2}
          fill="#FFFFFF"
          stroke={focusColor}
          strokeWidth={3}
          style={{filter: `drop-shadow(0 0 9px ${focusColor})`}}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 12,
          fontSize: 17,
          color: '#C9D9E7',
          fontWeight: 800,
          background: 'rgba(2,8,15,0.84)',
          padding: '7px 11px',
          borderRadius: 12,
        }}
      >
        日本を中心に東アジア・東南アジアを拡大
      </div>
    </div>
  );
};

const WorldMap = ({
  current,
  next,
  progress,
  phase,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
  phase: number;
}) => {
  const rendered = buildRenderedCountries(current, next, progress, worldPath);
  const pulse = (Math.sin(phase * Math.PI * 6) + 1) / 2;
  const japanState = interpolateCountry(
    countryFor(current, '392'),
    countryFor(next, '392'),
    progress,
  );
  const japanColor = japanState
    ? data.entities[japanState.leader].color
    : '#FFFFFF';

  return (
    <div
      style={{
        position: 'relative',
        height: 820,
        borderRadius: 38,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 45%, rgba(34,70,104,0.76), rgba(3,11,20,0.98) 72%)',
        border: '1px solid rgba(181,218,255,0.22)',
        boxShadow:
          'inset 0 0 100px rgba(35,111,171,0.18), 0 24px 58px rgba(0,0,0,0.40)',
      }}
    >
      <svg
        viewBox="0 0 1080 840"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        <defs>
          <filter id="organic-invasion-v5" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.026"
              numOctaves="2"
              seed="19"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {rendered
            .filter((item) => item.state && item.path)
            .map((item) => {
              const hash = Number(item.numericCode) % 4;
              const coordinates = [
                {x1: '0%', y1: '50%', x2: '100%', y2: '50%'},
                {x1: '50%', y1: '0%', x2: '50%', y2: '100%'},
                {x1: '0%', y1: '100%', x2: '100%', y2: '0%'},
                {x1: '100%', y1: '100%', x2: '0%', y2: '0%'},
              ][hash];
              return (
                <linearGradient
                  key={`gradient-${item.numericCode}`}
                  id={`share-${item.numericCode}`}
                  {...coordinates}
                >
                  <ShareStops
                    shares={item.state!.shares}
                    idPrefix={`world-${item.numericCode}`}
                  />
                </linearGradient>
              );
            })}
        </defs>
        <path
          d={spherePath}
          fill="#061522"
          stroke="rgba(124,188,231,0.42)"
          strokeWidth={1.2}
        />
        <path
          d={graticulePath}
          fill="none"
          stroke="rgba(128,183,220,0.14)"
          strokeWidth={0.7}
        />
        {rendered.map((item) => {
          if (!item.path) return null;
          if (!item.state) {
            return (
              <path
                key={`empty-${item.numericCode}-${item.index}`}
                d={item.path}
                fill={data.config.noDataColor}
                fillOpacity={0.78}
                stroke="rgba(183,204,226,0.34)"
                strokeWidth={0.62}
              />
            );
          }
          const changing =
            item.state.changingLeader && progress > 0.05 && progress < 0.97;
          return (
            <path
              key={`country-${item.numericCode}-${item.index}`}
              d={item.path}
              fill={`url(#share-${item.numericCode})`}
              stroke={changing ? '#FFFFFF' : 'rgba(214,228,243,0.54)'}
              strokeWidth={changing ? 1.25 + pulse * 1.25 : 0.65}
              strokeLinejoin="round"
              filter="url(#organic-invasion-v5)"
              style={{
                filter: changing
                  ? `drop-shadow(0 0 ${5 + pulse * 9}px ${
                      data.entities[item.state.leader].color
                    })`
                  : 'drop-shadow(0 1px 1px rgba(0,0,0,0.42))',
              }}
            />
          );
        })}
        <circle
          cx={japanPoint[0]}
          cy={japanPoint[1]}
          r={7 + pulse * 3}
          fill="#FFFFFF"
          stroke={japanColor}
          strokeWidth={4}
          style={{filter: `drop-shadow(0 0 12px ${japanColor})`}}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 17,
          padding: '10px 15px',
          borderRadius: 14,
          background: 'rgba(2,8,15,0.84)',
          color: '#D8E6F3',
          fontSize: 20,
          fontWeight: 850,
        }}
      >
        日本中心の世界地図
      </div>
      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 17,
          padding: '10px 15px',
          borderRadius: 14,
          background: 'rgba(2,8,15,0.84)',
          color: '#A9CBE4',
          fontSize: 19,
          fontWeight: 850,
        }}
      >
        色の割合＝実効支配割合（概算）
      </div>
      <PacificInset
        current={current}
        next={next}
        progress={progress}
        pulse={pulse}
      />
    </div>
  );
};

type LiveRanking = RankingRow & {position: number};

const Ranking = ({
  current,
  next,
  progress,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
}) => {
  const visibleEntities = entityOrder.filter(
    (entity) => !data.entities[entity].excludeFromRanking,
  );
  const currentRows = new Map(current.ranking.map((row) => [row.entity, row]));
  const nextRows = new Map(next.ranking.map((row) => [row.entity, row]));
  const rows: LiveRanking[] = visibleEntities.map((entity) => {
    const currentRow = currentRows.get(entity);
    const nextRow = nextRows.get(entity);
    const currentRank = currentRow?.rank ?? visibleEntities.length;
    const nextRank = nextRow?.rank ?? visibleEntities.length;
    return {
      entity,
      share: mix(currentRow?.share ?? 0, nextRow?.share ?? 0, progress),
      delta: (nextRow?.share ?? 0) - (currentRow?.share ?? 0),
      rank: Math.round(mix(currentRank, nextRank, progress)),
      position: mix(currentRank - 1, nextRank - 1, progress),
    };
  });
  const liveOrder = [...rows].sort(
    (a, b) =>
      b.share - a.share ||
      data.entities[a.entity].priority - data.entities[b.entity].priority,
  );
  const liveRank = new Map(
    liveOrder.map((row, index) => [row.entity, index + 1]),
  );
  const maxShare = Math.max(0.2, ...rows.map((row) => row.share));
  const rowHeight = 72;

  return (
    <div
      style={{
        position: 'relative',
        height: data.config.rankingSize * rowHeight,
        overflow: 'hidden',
      }}
    >
      {rows.map((row) => {
        const entity = data.entities[row.entity];
        const opacity = clamp(data.config.rankingSize + 0.5 - row.position);
        return (
          <div
            key={row.entity}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 64,
              transform: `translateY(${row.position * rowHeight}px)`,
              opacity,
              borderRadius: 19,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '50px 50px 1fr 170px',
              alignItems: 'center',
              gap: 12,
              padding: '0 19px',
              background:
                liveRank.get(row.entity) === 1
                  ? 'rgba(255,255,255,0.14)'
                  : 'rgba(255,255,255,0.057)',
              border:
                liveRank.get(row.entity) === 1
                  ? `1.6px solid ${entity.color}BB`
                  : '1px solid rgba(255,255,255,0.09)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${(row.share / maxShare) * 100}%`,
                background: `linear-gradient(90deg, ${entity.color}48, ${entity.color}09)`,
              }}
            />
            <div style={{zIndex: 1, fontSize: 27, fontWeight: 900}}>
              {liveRank.get(row.entity)}
            </div>
            <div style={{zIndex: 1}}>
              <EntityBadge entityName={row.entity} size={40} />
            </div>
            <div
              style={{
                zIndex: 1,
                fontSize: 26,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              {entity.displayName}
            </div>
            <div style={{zIndex: 1, textAlign: 'right'}}>
              <span style={{fontSize: 31, fontWeight: 900}}>
                {row.share.toFixed(2)}
              </span>
              <span style={{fontSize: 18, marginLeft: 4, color: '#B9C9D8'}}>
                %
              </span>
              {data.config.showDelta && Math.abs(row.delta) >= 0.005 ? (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 18,
                    fontWeight: 900,
                    color: row.delta > 0 ? '#70EDB0' : '#FF8799',
                  }}
                >
                  {row.delta > 0 ? '↗' : '↘'}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FocusFactionCard = ({
  current,
  next,
  progress,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
}) => {
  const entityName = data.config.focusFaction ?? 'Japan';
  const entity = data.entities[entityName];
  if (!entity) return null;
  const currentRow = current.ranking.find((row) => row.entity === entityName);
  const nextRow = next.ranking.find((row) => row.entity === entityName);
  const share = mix(currentRow?.share ?? 0, nextRow?.share ?? 0, progress);
  const rank = Math.round(
    mix(
      currentRow?.rank ?? data.config.rankingSize,
      nextRow?.rank ?? data.config.rankingSize,
      progress,
    ),
  );
  return (
    <div
      style={{
        marginTop: 14,
        minHeight: 142,
        borderRadius: 24,
        padding: '18px 21px',
        display: 'grid',
        gridTemplateColumns: '62px 1fr 230px',
        alignItems: 'center',
        gap: 16,
        background: `linear-gradient(135deg, ${entity.color}32, rgba(255,255,255,0.05))`,
        border: `1.4px solid ${entity.color}99`,
      }}
    >
      <EntityBadge entityName={entityName} size={55} />
      <div>
        <div style={{fontSize: 27, fontWeight: 900}}>
          {data.config.focusPanelTitle ?? `${entity.displayName}の勢力圏`}
        </div>
        <div
          style={{
            marginTop: 7,
            fontSize: 21,
            lineHeight: 1.4,
            color: '#C5D4E1',
            fontWeight: 750,
          }}
        >
          1939年9月と比べて新たに支配した陸地の割合
        </div>
      </div>
      <div style={{textAlign: 'right'}}>
        <div style={{fontSize: 18, color: '#B9C9D8', fontWeight: 850}}>
          現在 {rank}位
        </div>
        <div style={{fontSize: 43, color: entity.color, fontWeight: 900}}>
          {share.toFixed(2)}%
        </div>
      </div>
    </div>
  );
};

const eventAtPosition = (position: number) => {
  const holdPeriods =
    (data.config.eventHoldSeconds ?? 3) /
    Math.max(0.1, data.config.secondsPerPeriod ?? data.config.secondsPerYear);
  let selected:
    | {index: number; event: YearSnapshot['events'][number]}
    | undefined;
  data.years.forEach((snapshot, index) => {
    const event = snapshot.events[0];
    if (event && index <= position) selected = {index, event};
  });
  if (!selected) return null;
  const age = position - selected.index;
  if (age > holdPeriods) return null;
  const fadeIn = clamp(age / 0.35);
  const fadeOut = clamp((holdPeriods - age) / 0.55);
  return {event: selected.event, opacity: Math.min(fadeIn, fadeOut)};
};

const EventBanner = ({position}: {position: number}) => {
  const active = data.config.showEvents ? eventAtPosition(position) : null;
  if (!active) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 25,
        right: 25,
        bottom: 24,
        minHeight: 132,
        borderRadius: 24,
        padding: '18px 24px',
        display: 'grid',
        gridTemplateColumns: '50px 1fr',
        alignItems: 'center',
        gap: 17,
        opacity: active.opacity,
        transform: `translateY(${(1 - active.opacity) * 16}px)`,
        background:
          'linear-gradient(90deg, rgba(3,9,16,0.97), rgba(13,28,42,0.95))',
        border: '1.4px solid rgba(255,204,102,0.56)',
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        zIndex: 8,
      }}
    >
      <div style={{fontSize: 39, color: '#FFD166', textAlign: 'center'}}>
        ◆
      </div>
      <div>
        <div style={{fontSize: 31, lineHeight: 1.25, fontWeight: 900}}>
          {active.event.title}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 24,
            lineHeight: 1.42,
            color: '#D0DCE7',
            fontWeight: 700,
          }}
        >
          {active.event.description}
        </div>
      </div>
    </div>
  );
};

const Progress = ({ratio}: {ratio: number}) => (
  <div style={{marginTop: 14}}>
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamp(ratio) * 100}%`,
          borderRadius: 999,
          background: 'linear-gradient(90deg, #D65757, #E0455F, #4DB5E8)',
          boxShadow: '0 0 14px rgba(81,199,255,0.55)',
        }}
      />
    </div>
    <div
      style={{
        marginTop: 8,
        display: 'grid',
        gridTemplateColumns: '140px 1fr 140px',
        alignItems: 'center',
        fontSize: 17,
        color: '#8EA5B9',
        fontWeight: 800,
      }}
    >
      <span>{data.config.startPeriod}</span>
      <span style={{textAlign: 'center', fontSize: 16}}>
        {data.config.sourceLabel}
      </span>
      <span style={{textAlign: 'right'}}>{data.config.endPeriod}</span>
    </div>
  </div>
);

const MainScene = ({
  current,
  next,
  progress,
  phase,
  index,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
  phase: number;
  index: number;
}) => {
  const shown = progress < 0.5 ? current : next;
  const position = index + phase;
  const timelineRatio = position / Math.max(1, data.years.length - 1);
  const currentLeader = current.ranking[0]?.entity;
  const nextLeader = next.ranking[0]?.entity;
  const leader = progress < 0.5 ? currentLeader : nextLeader;
  const leaderColor = leader ? data.entities[leader].color : '#AFC0D3';

  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '34px 42px 28px',
        background: `radial-gradient(circle at 50% 28%, #182D41 0%, ${data.config.backgroundColor} 60%, #020408 100%)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{maxWidth: 745}}>
          <div style={{fontSize: 42, lineHeight: 1.2, fontWeight: 900}}>
            {data.config.displayTitle ?? data.config.title}
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 23,
              color: '#D3E2EF',
              fontWeight: 800,
            }}
          >
            {data.config.subtitle}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 19,
              color: '#78BFE9',
              fontWeight: 800,
            }}
          >
            {data.config.metricLabel}
          </div>
        </div>
        <div style={{textAlign: 'right', minWidth: 250}}>
          <div
            style={{
              fontSize: 58,
              lineHeight: 1.02,
              fontWeight: 900,
              letterSpacing: -2,
            }}
          >
            {shown.year}年
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 34,
              color: '#FFD277',
              fontWeight: 900,
            }}
          >
            {shown.month ?? 1}月
          </div>
        </div>
      </div>

      <div style={{position: 'relative', marginTop: 16}}>
        <WorldMap
          current={current}
          next={next}
          progress={progress}
          phase={phase}
        />
        <EventBanner position={position} />
      </div>

      <div style={{marginTop: 15}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
          }}
        >
          <div style={{fontSize: 25, fontWeight: 900, color: '#D7E4EF'}}>
            {data.config.rankingLabel}
          </div>
          <div style={{fontSize: 20, color: leaderColor, fontWeight: 900}}>
            拡大面積首位：
            {leader ? data.entities[leader].displayName : '変化なし'}
          </div>
        </div>
        <Ranking current={current} next={next} progress={progress} />
        <FocusFactionCard
          current={current}
          next={next}
          progress={progress}
        />
        <Progress ratio={timelineRatio} />
      </div>
    </AbsoluteFill>
  );
};

const Intro = ({frame, fps}: {frame: number; fps: number}) => {
  const entrance = spring({
    frame,
    fps,
    config: {damping: 15, stiffness: 105, mass: 0.8},
  });
  const marks = (data.config.introEntities ?? entityOrder).slice(0, 6);
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 64,
        color: '#FFFFFF',
        textAlign: 'center',
        fontFamily,
        background: `radial-gradient(circle at center, #24384B 0%, ${data.config.backgroundColor} 65%, #010307 100%)`,
      }}
    >
      <div
        style={{
          fontSize: 29,
          color: '#79CFFF',
          fontWeight: 900,
          letterSpacing: 3,
        }}
      >
        {data.config.categoryTitle ?? data.config.title}
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 72,
          lineHeight: 1.23,
          fontWeight: 900,
          whiteSpace: 'pre-line',
          transform: `scale(${0.84 + entrance * 0.16})`,
          textShadow: '0 0 34px rgba(232,72,91,0.22)',
        }}
      >
        {data.config.hookText ?? data.config.title}
      </div>
      <div
        style={{
          marginTop: 43,
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
        }}
      >
        {marks.map((mark, index) => {
          const item = spring({
            frame: frame - index * 3,
            fps,
            config: {damping: 14, stiffness: 130},
          });
          return (
            <div
              key={mark}
              style={{
                transform: `translateY(${(1 - item) * 36}px) scale(${item})`,
                opacity: item,
              }}
            >
              <EntityBadge entityName={mark} size={72} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 48,
          padding: '25px 34px',
          borderRadius: 25,
          background: 'rgba(255,255,255,0.075)',
          border: '1px solid rgba(255,255,255,0.17)',
        }}
      >
        <div style={{fontSize: 31, fontWeight: 900}}>
          {data.config.shareExplanation}
        </div>
        <div
          style={{
            marginTop: 11,
            fontSize: 24,
            lineHeight: 1.45,
            color: '#C4D3E0',
            fontWeight: 750,
          }}
        >
          現代の国境に置き換えた概算で、占領地域の拡大と縮小を追います
        </div>
      </div>
      <div style={{marginTop: 41, fontSize: 37, fontWeight: 900}}>
        {data.config.startPeriod}{' '}
        <span style={{color: '#6ABDEB'}}>→</span>{' '}
        {data.config.endPeriod}
      </div>
    </AbsoluteFill>
  );
};

const peakFor = (entity: string) => {
  let best = {share: -1, period: ''};
  for (const snapshot of data.years) {
    const share =
      snapshot.ranking.find((row) => row.entity === entity)?.share ?? 0;
    if (share > best.share) best = {share, period: snapshot.period ?? ''};
  }
  return best;
};

const SummaryCard = ({entity}: {entity: string}) => {
  const config = data.entities[entity];
  const peak = peakFor(entity);
  const final =
    data.years[data.years.length - 1].ranking.find(
      (row) => row.entity === entity,
    )?.share ?? 0;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 205,
        padding: '24px 22px',
        borderRadius: 26,
        background: `linear-gradient(145deg, ${config.color}30, rgba(255,255,255,0.055))`,
        border: `1.4px solid ${config.color}88`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 13}}>
        <EntityBadge entityName={entity} size={52} />
        <div style={{fontSize: 29, fontWeight: 900}}>
          {config.displayName}
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 18,
          color: '#B9C9D8',
          fontWeight: 800,
        }}
      >
        最大拡大
      </div>
      <div style={{marginTop: 4, fontSize: 37, fontWeight: 900}}>
        <span style={{color: config.color}}>{peak.share.toFixed(2)}%</span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 18,
          color: '#D3DFE9',
          fontWeight: 800,
        }}
      >
        {peak.period}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 18,
          color: '#9EB1C2',
          fontWeight: 800,
        }}
      >
        終戦時 {final.toFixed(2)}%
      </div>
    </div>
  );
};

const Outro = ({
  frame,
  startFrame,
  fps,
}: {
  frame: number;
  startFrame: number;
  fps: number;
}) => {
  const local = frame - startFrame;
  const reveal = spring({
    frame: local,
    fps,
    config: {damping: 17, stiffness: 105},
  });
  const lessons = data.config.endingLessons ?? [];
  const summaryEntities = (
    data.config.summaryEntities ?? entityOrder.slice(0, 3)
  ).slice(0, 3);

  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '58px 48px 34px',
        background: `radial-gradient(circle at 50% 28%, #1D3449, ${data.config.backgroundColor} 66%, #010307)`,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          transform: `translateY(${(1 - reveal) * 25}px)`,
          opacity: reveal,
        }}
      >
        <div
          style={{
            fontSize: 86,
            lineHeight: 1.08,
            color: '#FFFFFF',
            fontWeight: 900,
          }}
        >
          最終結果
        </div>
        <div
          style={{
            marginTop: 13,
            fontSize: 28,
            color: '#86D3FF',
            fontWeight: 900,
          }}
        >
          1939年9月から1945年9月まで
        </div>
      </div>

      <div style={{marginTop: 43, display: 'flex', gap: 16}}>
        {summaryEntities.map((entity) => (
          <SummaryCard key={entity} entity={entity} />
        ))}
      </div>

      <div
        style={{
          marginTop: 34,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {lessons.map((lesson, index) => (
          <div
            key={lesson}
            style={{
              display: 'grid',
              gridTemplateColumns: '68px 1fr',
              alignItems: 'center',
              gap: 20,
              minHeight: 132,
              padding: '22px 25px',
              borderRadius: 25,
              background: 'rgba(255,255,255,0.078)',
              border: '1px solid rgba(134,199,242,0.24)',
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(145deg, #4A7699, #263E54)',
                fontSize: 31,
                fontWeight: 900,
              }}
            >
              {index + 1}
            </div>
            <div
              style={{
                fontSize: 31,
                lineHeight: 1.48,
                fontWeight: 850,
              }}
            >
              {lesson}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 39,
          padding: '29px 30px',
          minHeight: 205,
          borderRadius: 28,
          textAlign: 'center',
          background:
            'linear-gradient(135deg, rgba(255,190,62,0.19), rgba(255,255,255,0.065))',
          border: '1.7px solid rgba(255,205,105,0.58)',
          boxShadow: '0 0 34px rgba(255,185,55,0.13)',
        }}
      >
        <div style={{fontSize: 26, color: '#FFD277', fontWeight: 900}}>
          コメントで教えてください
        </div>
        <div
          style={{
            marginTop: 13,
            fontSize: 37,
            lineHeight: 1.48,
            fontWeight: 900,
            whiteSpace: 'pre-line',
          }}
        >
          {data.config.discussionPrompt}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 21,
          left: 38,
          right: 38,
          textAlign: 'center',
          fontSize: 17,
          lineHeight: 1.4,
          color: '#788EA2',
        }}
      >
        {data.config.sourceLabel}
        <br />
        現代国境換算の概算であり、厳密な前線・法的主権を示すものではありません
      </div>
    </AbsoluteFill>
  );
};

export const GeoBaseVideoV5 = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {config, years} = data;
  const introFrames = Math.round(config.introSeconds * fps);
  const periodFrames = Math.max(
    1,
    Math.round((config.secondsPerPeriod ?? config.secondsPerYear) * fps),
  );
  const intervalCount = Math.max(1, years.length - 1);
  const mainFrames = intervalCount * periodFrames;
  const mainStart = introFrames;
  const outroStart = mainStart + mainFrames;

  if (frame < introFrames) return <Intro frame={frame} fps={fps} />;
  if (frame >= outroStart) {
    return <Outro frame={frame} startFrame={outroStart} fps={fps} />;
  }

  const relativeFrame = Math.max(0, frame - mainStart);
  const index = Math.min(
    intervalCount - 1,
    Math.floor(relativeFrame / periodFrames),
  );
  const phase = (relativeFrame % periodFrames) / periodFrames;
  const progress = Easing.inOut(Easing.cubic)(phase);
  const current = years[index];
  const next = years[Math.min(years.length - 1, index + 1)];

  return (
    <MainScene
      current={current}
      next={next}
      progress={progress}
      phase={phase}
      index={index}
    />
  );
};
