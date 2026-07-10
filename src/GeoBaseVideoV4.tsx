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

const centerLongitude = data.config.mapCenterLongitude ?? 150;
const projection = geoNaturalEarth1()
  .rotate([-centerLongitude, 0])
  .fitExtent(
    [
      [18, 22],
      [1062, 790],
    ],
    world as never,
  );
const mapPath = geoPath(projection);
const spherePath = mapPath({type: 'Sphere'} as never) ?? undefined;
const graticulePath = mapPath(geoGraticule10() as never) ?? undefined;
const focusFeature = world.features.find(
  (country) => String(country.id ?? '').padStart(3, '0') === '392',
);
const focusPoint = focusFeature ? mapPath.centroid(focusFeature as never) : [540, 370];
const japanProjection = geoMercator();
if (focusFeature) {
  japanProjection.fitExtent(
    [
      [24, 18],
      [276, 178],
    ],
    focusFeature as never,
  );
} else {
  japanProjection.center([138, 37]).scale(950).translate([150, 100]);
}
const japanPath = geoPath(japanProjection);
const japanOutline = focusFeature ? japanPath(focusFeature as never) ?? undefined : undefined;

const fontFamily =
  '"Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';
const entityOrder = Object.keys(data.entities).sort(
  (a, b) => data.entities[a].priority - data.entities[b].priority,
);

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const entityMark = (entity: string) => {
  const marks: Record<string, string> = {
    ChatGPT: 'GPT',
    'Google Gemini': 'G',
    Perplexity: 'P',
    Claude: 'C',
    'Microsoft Copilot': 'Co',
    DeepSeek: 'DS',
  };
  return marks[entity] ?? entity.slice(0, 2);
};

const EntityBadge = ({entityName, size}: {entityName: string; size: number}) => {
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
        fontSize: size * (entityMark(entityName).length >= 3 ? 0.25 : 0.38),
        fontWeight: 900,
        border: '2px solid rgba(255,255,255,0.48)',
        boxShadow: `0 0 ${size * 0.38}px ${entity.color}66`,
      }}
    >
      {entityMark(entityName)}
    </div>
  );
};

const countryFor = (snapshot: YearSnapshot, countryCode?: string) =>
  countryCode
    ? snapshot.countries.find((country) => country.countryCode === countryCode)
    : undefined;

const rankingShare = (snapshot: YearSnapshot, entity: string) =>
  snapshot.ranking.find((row) => row.entity === entity)?.share ?? 0;

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
  const shares = entityOrder.map((entity) => {
    const from = current ? shareValue(current, entity) : shareValue(next, entity);
    const to = next ? shareValue(next, entity) : shareValue(current, entity);
    return {entity, value: mix(from, to, progress)};
  });
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

const ShareStops = ({shares}: {shares: BrowserShare[]}) => {
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
          <stop key={`${share.entity}-start`} offset={`${start}%`} stopColor={color} />,
          <stop key={`${share.entity}-end`} offset={`${end}%`} stopColor={color} />,
        ];
      })}
    </>
  );
};

const JapanInset = ({focus, pulse}: {focus: InterpolatedCountry; pulse: number}) => {
  const leader = data.entities[focus.leader];
  return (
    <div
      style={{
        position: 'absolute',
        left: 385,
        top: 78,
        width: 310,
        height: 242,
        borderRadius: 25,
        overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(3,13,24,0.96), rgba(18,48,72,0.94))',
        border: `1.5px solid ${leader.color}AA`,
        boxShadow: `0 12px 30px rgba(0,0,0,0.38), 0 0 22px ${leader.color}33`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          zIndex: 2,
          left: 16,
          top: 12,
          fontSize: 23,
          fontWeight: 900,
        }}
      >
        日本拡大
      </div>
      <svg
        viewBox="0 0 300 200"
        style={{position: 'absolute', left: 5, top: 27, width: 300, height: 190}}
      >
        <defs>
          <filter id="japan-organic-v4" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.035"
              numOctaves="2"
              seed="27"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <linearGradient id="japan-share-v4" x1="0%" y1="0%" x2="100%" y2="100%">
            <ShareStops shares={focus.shares} />
          </linearGradient>
        </defs>
        <path
          d={japanOutline}
          fill="url(#japan-share-v4)"
          stroke="#FFFFFF"
          strokeWidth={1.8 + pulse * 0.6}
          strokeLinejoin="round"
          filter="url(#japan-organic-v4)"
          style={{filter: `drop-shadow(0 0 ${8 + pulse * 7}px ${leader.color})`}}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          right: 13,
          bottom: 12,
          padding: '9px 13px',
          borderRadius: 15,
          background: 'rgba(1,8,15,0.88)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        <EntityBadge entityName={focus.leader} size={32} />
        <span>{leader.displayName}</span>
        <span style={{color: leader.color}}>{focus.leaderShare.toFixed(1)}%</span>
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
  const currentCountries = new Map(
    current.countries.map((country) => [country.numericCode, country]),
  );
  const nextCountries = new Map(
    next.countries.map((country) => [country.numericCode, country]),
  );
  const rendered = world.features.map((country, index) => {
    const numericCode = String(country.id ?? '').padStart(3, '0');
    const path = mapPath(country as never) ?? undefined;
    const state = interpolateCountry(
      currentCountries.get(numericCode),
      nextCountries.get(numericCode),
      progress,
    );
    return {index, numericCode, path, state};
  });
  const pulse = (Math.sin(phase * Math.PI * 6) + 1) / 2;
  const focus = interpolateCountry(
    countryFor(current, data.config.focusCountryCode),
    countryFor(next, data.config.focusCountryCode),
    progress,
  );
  const focusColor = focus ? data.entities[focus.leader].color : '#FFFFFF';

  return (
    <div
      style={{
        position: 'relative',
        height: 820,
        borderRadius: 38,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 45%, rgba(28,77,116,0.78), rgba(3,12,22,0.98) 70%)',
        border: '1px solid rgba(181,218,255,0.22)',
        boxShadow:
          'inset 0 0 100px rgba(35,111,171,0.20), 0 24px 58px rgba(0,0,0,0.38)',
      }}
    >
      <svg
        viewBox="0 0 1080 840"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        <defs>
          <filter id="organic-invasion-v4" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.013 0.028"
              numOctaves="2"
              seed="19"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="17"
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
                  <ShareStops shares={item.state!.shares} />
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
          stroke="rgba(128,183,220,0.16)"
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
                fillOpacity={0.72}
                stroke="rgba(183,204,226,0.34)"
                strokeWidth={0.62}
              />
            );
          }
          const changing = item.state.changingLeader && progress > 0.08 && progress < 0.94;
          return (
            <path
              key={`country-${item.numericCode}-${item.index}`}
              d={item.path}
              fill={`url(#share-${item.numericCode})`}
              stroke={changing ? '#FFFFFF' : 'rgba(214,228,243,0.56)'}
              strokeWidth={changing ? 1.3 + pulse * 1.4 : 0.66}
              strokeLinejoin="round"
              filter="url(#organic-invasion-v4)"
              style={{
                filter: changing
                  ? `drop-shadow(0 0 ${6 + pulse * 10}px ${data.entities[item.state.leader].color})`
                  : 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
              }}
            />
          );
        })}
        {focus ? (
          <g>
            <circle
              cx={focusPoint[0]}
              cy={focusPoint[1]}
              r={8 + pulse * 4}
              fill="#FFFFFF"
              stroke={focusColor}
              strokeWidth={5}
              style={{filter: `drop-shadow(0 0 14px ${focusColor})`}}
            />
            <path
              d={`M${focusPoint[0] + 8},${focusPoint[1] - 8} L${focusPoint[0] + 40},${focusPoint[1] - 40}`}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          </g>
        ) : null}
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
          fontSize: 21,
          fontWeight: 800,
        }}
      >
        日本から見る世界
      </div>
      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 17,
          padding: '10px 15px',
          borderRadius: 14,
          background: 'rgba(2,8,15,0.84)',
          color: '#9FC4E2',
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        色の面積＝利用シェア
      </div>
      {focus ? <JapanInset focus={focus} pulse={pulse} /> : null}
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
  const currentRows = new Map(current.ranking.map((row) => [row.entity, row]));
  const nextRows = new Map(next.ranking.map((row) => [row.entity, row]));
  const rows: LiveRanking[] = entityOrder.map((entity) => {
    const currentRow = currentRows.get(entity);
    const nextRow = nextRows.get(entity);
    const currentRank = currentRow?.rank ?? entityOrder.length;
    const nextRank = nextRow?.rank ?? entityOrder.length;
    return {
      entity,
      share: mix(currentRow?.share ?? 0, nextRow?.share ?? 0, progress),
      delta: (nextRow?.share ?? 0) - (currentRow?.share ?? 0),
      rank: Math.round(mix(currentRank, nextRank, progress)),
      position: mix(currentRank - 1, nextRank - 1, progress),
    };
  });
  const liveOrder = [...rows].sort((a, b) => b.share - a.share);
  const liveRank = new Map(liveOrder.map((row, index) => [row.entity, index + 1]));
  const maxShare = Math.max(1, ...rows.map((row) => row.share));
  const rowHeight = 78;

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
              height: 69,
              transform: `translateY(${row.position * rowHeight}px)`,
              opacity,
              borderRadius: 20,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '52px 52px 1fr 170px',
              alignItems: 'center',
              gap: 13,
              padding: '0 20px',
              background:
                liveRank.get(row.entity) === 1
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(255,255,255,0.06)',
              border:
                liveRank.get(row.entity) === 1
                  ? `1.5px solid ${entity.color}CC`
                  : '1px solid rgba(255,255,255,0.09)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${(row.share / maxShare) * 100}%`,
                background: `linear-gradient(90deg, ${entity.color}4D, ${entity.color}0A)`,
              }}
            />
            <div style={{zIndex: 1, fontSize: 29, fontWeight: 900}}>
              {liveRank.get(row.entity)}
            </div>
            <div style={{zIndex: 1}}>
              <EntityBadge entityName={row.entity} size={43} />
            </div>
            <div
              style={{
                zIndex: 1,
                fontSize: 29,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              {entity.displayName}
            </div>
            <div style={{zIndex: 1, textAlign: 'right'}}>
              <span style={{fontSize: 36, fontWeight: 900}}>{row.share.toFixed(1)}</span>
              <span style={{fontSize: 20, marginLeft: 4, color: '#AFC0D3'}}>%</span>
              {data.config.showDelta && Math.abs(row.delta) >= 0.03 ? (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 20,
                    fontWeight: 900,
                    color: row.delta > 0 ? '#6BF0AF' : '#FF8597',
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

const FocusCard = ({
  current,
  next,
  progress,
  large = false,
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
  large?: boolean;
}) => {
  const focus = interpolateCountry(
    countryFor(current, data.config.focusCountryCode),
    countryFor(next, data.config.focusCountryCode),
    progress,
  );
  if (!focus) return null;
  const topThree = focus.rankedShares.slice(0, 3);
  return (
    <div
      style={{
        marginTop: large ? 24 : 15,
        minHeight: large ? 210 : 172,
        borderRadius: large ? 29 : 25,
        padding: large ? '24px 27px 23px' : '19px 22px 18px',
        background:
          'linear-gradient(135deg, rgba(28,66,97,0.78), rgba(255,255,255,0.055))',
        border: '1px solid rgba(113,190,241,0.48)',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontSize: large ? 34 : 29, fontWeight: 900}}>
          {data.config.focusPanelTitle ?? `${data.config.focusCountryLabel ?? '日本'}の利用シェア`}
        </div>
        <div style={{fontSize: large ? 23 : 20, color: '#AFC7DB', fontWeight: 800}}>
          上位3サービス
        </div>
      </div>
      <div
        style={{
          marginTop: large ? 18 : 14,
          height: large ? 34 : 28,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 999,
          background: '#172334',
          border: '1px solid rgba(255,255,255,0.16)',
        }}
      >
        {focus.shares.map((share) => (
          <div
            key={share.entity}
            style={{
              width: `${share.value}%`,
              height: '100%',
              background: data.entities[share.entity].color,
              boxShadow: `0 0 10px ${data.entities[share.entity].color}66`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          marginTop: large ? 18 : 14,
          display: 'flex',
          gap: large ? 34 : 27,
          alignItems: 'center',
        }}
      >
        {topThree.map((share) => (
          <div key={share.entity} style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <EntityBadge entityName={share.entity} size={large ? 45 : 38} />
            <div>
              <div style={{fontSize: large ? 25 : 22, fontWeight: 900}}>
                {data.entities[share.entity].displayName}
              </div>
              <div
                style={{
                  fontSize: large ? 27 : 23,
                  color: data.entities[share.entity].color,
                  fontWeight: 900,
                }}
              >
                {share.value.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EventBanner = ({index, phase}: {index: number; phase: number}) => {
  if (!data.config.showEvents) return null;
  const visiblePeriods = 4;
  let eventIndex = -1;
  for (let candidate = index; candidate >= Math.max(0, index - visiblePeriods + 1); candidate--) {
    if (data.years[candidate]?.events[0]) {
      eventIndex = candidate;
      break;
    }
  }
  if (eventIndex < 0) return null;
  const event = data.years[eventIndex].events[0];
  const progress = (index - eventIndex + phase) / visiblePeriods;
  const opacity = interpolate(progress, [0, 0.07, 0.82, 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 28,
        right: 28,
        bottom: 26,
        minHeight: 138,
        borderRadius: 26,
        padding: '19px 24px',
        display: 'grid',
        gridTemplateColumns: '48px 1fr',
        alignItems: 'center',
        gap: 17,
        opacity,
        transform: `translateY(${(1 - opacity) * 22}px)`,
        background:
          'linear-gradient(90deg, rgba(3,9,16,0.97), rgba(13,31,48,0.96))',
        border: '1.5px solid rgba(255,204,102,0.62)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.34)',
      }}
    >
      <div style={{fontSize: 39, color: '#FFD166', textAlign: 'center'}}>◆</div>
      <div>
        <div style={{fontSize: 32, lineHeight: 1.25, fontWeight: 900}}>{event.title}</div>
        <div
          style={{
            marginTop: 7,
            fontSize: 25,
            lineHeight: 1.42,
            color: '#D5E0EA',
            fontWeight: 700,
          }}
        >
          {event.description}
        </div>
      </div>
    </div>
  );
};

const Progress = ({ratio}: {ratio: number}) => (
  <div style={{marginTop: 17}}>
    <div
      style={{
        height: 9,
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
          background: 'linear-gradient(90deg, #10A37F, #4E8DF7, #9B6CFF)',
          boxShadow: '0 0 14px rgba(81,199,255,0.65)',
        }}
      />
    </div>
    <div
      style={{
        marginTop: 9,
        display: 'grid',
        gridTemplateColumns: '140px 1fr 140px',
        alignItems: 'center',
        fontSize: 18,
        color: '#91A7BC',
        fontWeight: 800,
      }}
    >
      <span>{data.config.startPeriod ?? `${data.config.startYear}年`}</span>
      <span style={{textAlign: 'center'}}>{data.config.sourceLabel}</span>
      <span style={{textAlign: 'right'}}>{data.config.endPeriod ?? `${data.config.endYear}年`}</span>
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
  const currentLeader = current.ranking[0]?.entity;
  const nextLeader = next.ranking[0]?.entity;
  const leader = progress < 0.5 ? currentLeader : nextLeader;
  const leaderColor = leader ? data.entities[leader].color : '#AFC0D3';
  const timelineRatio = (index + phase) / Math.max(1, data.years.length - 1);

  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '36px 40px 28px',
        background: `radial-gradient(circle at 50% 28%, #102B43 0%, ${data.config.backgroundColor} 58%, #020408 100%)`,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{maxWidth: 720}}>
          <div style={{fontSize: 47, lineHeight: 1.12, fontWeight: 900}}>{data.config.title}</div>
          <div style={{marginTop: 8, fontSize: 27, lineHeight: 1.35, color: '#D3E2EF', fontWeight: 800}}>
            {data.config.subtitle}
          </div>
          <div style={{marginTop: 6, fontSize: 21, color: '#75BDE8', fontWeight: 750}}>
            {data.config.metricLabel}
          </div>
        </div>
        <div style={{textAlign: 'right', minWidth: 250}}>
          <div style={{fontSize: 62, lineHeight: 1, fontWeight: 900, letterSpacing: -2}}>
            {shown.year}年
          </div>
          <div style={{marginTop: 7, fontSize: 37, color: '#FFD277', fontWeight: 900}}>
            {shown.month ?? 1}月
          </div>
        </div>
      </div>
      <div style={{position: 'relative', marginTop: 18}}>
        <WorldMap current={current} next={next} progress={progress} phase={phase} />
        <EventBanner index={index} phase={phase} />
      </div>
      <div style={{marginTop: 18}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 12,
          }}
        >
          <div style={{fontSize: 27, fontWeight: 900, color: '#D1DFEB'}}>
            {data.config.rankingLabel ?? '主要国の平均利用シェア'}
          </div>
          <div style={{fontSize: 23, color: leaderColor, fontWeight: 900}}>
            現在の首位：{leader ? data.entities[leader].displayName : '集計中'}
          </div>
        </div>
        <Ranking current={current} next={next} progress={progress} />
        <FocusCard current={current} next={next} progress={progress} />
        <Progress ratio={timelineRatio} />
      </div>
    </AbsoluteFill>
  );
};

const Intro = ({frame, fps}: {frame: number; fps: number}) => {
  const entrance = spring({frame, fps, config: {damping: 15, stiffness: 105, mass: 0.8}});
  const marks = (data.config.introEntities ?? entityOrder).slice(0, 6);
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 66,
        color: '#FFFFFF',
        textAlign: 'center',
        fontFamily,
        background: `radial-gradient(circle at center, #153E5E 0%, ${data.config.backgroundColor} 63%, #010307 100%)`,
      }}
    >
      <div style={{fontSize: 34, color: '#77CFFF', fontWeight: 900, letterSpacing: 3}}>
        {data.config.categoryTitle ?? data.config.title}
      </div>
      <div
        style={{
          marginTop: 27,
          fontSize: 76,
          lineHeight: 1.24,
          fontWeight: 900,
          whiteSpace: 'pre-line',
          transform: `scale(${0.84 + entrance * 0.16})`,
          textShadow: '0 0 32px rgba(82,190,255,0.25)',
        }}
      >
        {data.config.hookText ?? data.config.title}
      </div>
      <div style={{marginTop: 43, display: 'flex', gap: 17, justifyContent: 'center'}}>
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
              <EntityBadge entityName={mark} size={76} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 50,
          padding: '27px 36px',
          borderRadius: 27,
          background: 'rgba(255,255,255,0.075)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <div style={{fontSize: 34, lineHeight: 1.35, fontWeight: 900}}>
          {data.config.shareExplanation ?? '各国の色の割合＝利用シェア'}
        </div>
        <div style={{marginTop: 12, fontSize: 28, lineHeight: 1.45, color: '#BED0E0', fontWeight: 750}}>
          世界と日本で、選ばれるサービスの違いを追います
        </div>
      </div>
      <div style={{marginTop: 46, fontSize: 41, fontWeight: 900}}>
        {data.config.startPeriod ?? data.config.startYear}{' '}
        <span style={{color: '#6ABDEB'}}>→</span>{' '}
        {data.config.endPeriod ?? data.config.endYear}
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
        minHeight: 178,
        padding: '25px 24px',
        borderRadius: 28,
        background: `linear-gradient(145deg, ${config.color}30, rgba(255,255,255,0.06))`,
        border: `1.5px solid ${config.color}99`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 15}}>
        <EntityBadge entityName={entity} size={56} />
        <div style={{fontSize: 31, fontWeight: 900}}>{config.displayName}</div>
      </div>
      <div style={{marginTop: 22, fontSize: 39, fontWeight: 900}}>
        {before.toFixed(1)}% <span style={{color: '#8298AD'}}>→</span>{' '}
        <span style={{color: config.color}}>{after.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const Outro = ({frame, startFrame, fps}: {frame: number; startFrame: number; fps: number}) => {
  const local = frame - startFrame;
  const reveal = spring({frame: local, fps, config: {damping: 17, stiffness: 105}});
  const first = data.years[0];
  const last = data.years[data.years.length - 1];
  const lessons = data.config.endingLessons ?? [];
  const summaryEntities = (data.config.summaryEntities ?? entityOrder.slice(0, 2)).slice(0, 2);
  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '48px 46px 32px',
        background: `radial-gradient(circle at 50% 28%, #12314B, ${data.config.backgroundColor} 64%, #010307)`,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          transform: `translateY(${(1 - reveal) * 25}px)`,
          opacity: reveal,
        }}
      >
        <div style={{fontSize: 84, lineHeight: 1.05, fontWeight: 900}}>最終結果</div>
        <div style={{marginTop: 14, fontSize: 28, color: '#9FD9FF', fontWeight: 850}}>
          {data.config.startPeriod ?? data.config.startYear} → {data.config.endPeriod ?? data.config.endYear}
        </div>
      </div>
      <div style={{marginTop: 38, display: 'flex', flexDirection: 'column', gap: 18}}>
        {lessons.map((lesson, index) => (
          <div
            key={lesson}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr',
              alignItems: 'center',
              gap: 20,
              minHeight: 142,
              padding: '23px 27px',
              borderRadius: 28,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(134,199,242,0.28)',
            }}
          >
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(145deg, #3EA9F5, #195D9B)',
                fontSize: 33,
                fontWeight: 900,
              }}
            >
              {index + 1}
            </div>
            <div style={{fontSize: 34, lineHeight: 1.5, fontWeight: 850}}>{lesson}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 28, display: 'flex', gap: 18}}>
        {summaryEntities.map((entity) => (
          <SummaryCard
            key={entity}
            entity={entity}
            before={rankingShare(first, entity)}
            after={rankingShare(last, entity)}
          />
        ))}
      </div>
      <FocusCard current={last} next={last} progress={0} large />
      <div
        style={{
          marginTop: 28,
          minHeight: 230,
          padding: '31px 34px',
          borderRadius: 31,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, rgba(255,190,62,0.19), rgba(255,255,255,0.07))',
          border: '1.5px solid rgba(255,205,105,0.58)',
          boxShadow: '0 0 30px rgba(255,185,55,0.13)',
        }}
      >
        <div style={{fontSize: 29, color: '#FFD277', fontWeight: 900}}>
          コメントで教えてください
        </div>
        <div style={{marginTop: 15, fontSize: 40, lineHeight: 1.55, fontWeight: 900}}>
          {data.config.discussionPrompt}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 38,
          right: 38,
          textAlign: 'center',
          fontSize: 16,
          color: '#71879C',
        }}
      >
        {data.config.sourceLabel}
      </div>
    </AbsoluteFill>
  );
};

export const GeoBaseVideoV4 = () => {
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
  if (frame >= outroStart) return <Outro frame={frame} startFrame={outroStart} fps={fps} />;

  const relativeFrame = Math.max(0, frame - mainStart);
  const index = Math.min(intervalCount - 1, Math.floor(relativeFrame / periodFrames));
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
