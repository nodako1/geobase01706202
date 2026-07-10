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
const graticulePath = mapPath(geoGraticule10() as never) ?? undefined;
const spherePath = mapPath({type: 'Sphere'} as never) ?? undefined;
const focusFeature = world.features.find(
  (country) => String(country.id ?? '').padStart(3, '0') === '392',
);
const focusPoint = focusFeature ? mapPath.centroid(focusFeature as never) : [540, 360];

const fontFamily =
  '"Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';
const entityOrder = Object.keys(data.entities).sort(
  (a, b) => data.entities[a].priority - data.entities[b].priority,
);

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

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
        fontSize: size * (entityName === 'UC Browser' ? 0.28 : 0.38),
        fontWeight: 900,
        border: '2px solid rgba(255,255,255,0.48)',
        boxShadow: `0 0 ${size * 0.38}px ${entity.color}66`,
      }}
    >
      {browserMark(entityName)}
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
  const shares = entityOrder.map((entity) => ({
    entity,
    value: mix(shareValue(current, entity), shareValue(next, entity), progress),
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

const gradientCoordinates = (
  numericCode: string,
  bounds: [[number, number], [number, number]],
) => {
  const [[x0, y0], [x1, y1]] = bounds;
  const hash = Number(numericCode) % 4;
  if (hash === 0) return {x1: x0, y1: (y0 + y1) / 2, x2: x1, y2: (y0 + y1) / 2};
  if (hash === 1) return {x1: (x0 + x1) / 2, y1: y0, x2: (x0 + x1) / 2, y2: y1};
  if (hash === 2) return {x1: x0, y1: y1, x2: x1, y2: y0};
  return {x1: x1, y1: y1, x2: x0, y2: y0};
};

const ShareStops = ({shares}: {shares: BrowserShare[]}) => {
  let cursor = 0;
  const visible = shares.filter((share) => share.value >= 0.08);
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
    const bounds = mapPath.bounds(country as never) as [[number, number], [number, number]];
    return {country, index, numericCode, path, state, bounds};
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
        height: 840,
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
          <filter id="organic-invasion" x="-12%" y="-12%" width="124%" height="124%">
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
              const coordinates = gradientCoordinates(item.numericCode, item.bounds);
              return (
                <g key={`defs-${item.numericCode}`}>
                  <clipPath id={`clip-${item.numericCode}`}>
                    <path d={item.path} />
                  </clipPath>
                  <linearGradient
                    id={`share-${item.numericCode}`}
                    gradientUnits="userSpaceOnUse"
                    {...coordinates}
                  >
                    <ShareStops shares={item.state!.shares} />
                  </linearGradient>
                </g>
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
          const [[x0, y0], [x1, y1]] = item.bounds;
          const changing = item.state.changingLeader && progress > 0.08 && progress < 0.94;
          return (
            <g key={`country-${item.numericCode}-${item.index}`}>
              <g clipPath={`url(#clip-${item.numericCode})`}>
                <rect
                  x={x0 - 24}
                  y={y0 - 24}
                  width={Math.max(1, x1 - x0 + 48)}
                  height={Math.max(1, y1 - y0 + 48)}
                  fill={`url(#share-${item.numericCode})`}
                  filter="url(#organic-invasion)"
                />
              </g>
              <path
                d={item.path}
                fill="none"
                stroke={changing ? '#FFFFFF' : 'rgba(214,228,243,0.56)'}
                strokeWidth={changing ? 1.3 + pulse * 1.4 : 0.66}
                strokeLinejoin="round"
                style={{
                  filter: changing
                    ? `drop-shadow(0 0 ${6 + pulse * 10}px ${data.entities[item.state.leader].color})`
                    : 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
                }}
              />
            </g>
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
            <rect
              x={focusPoint[0] + 35}
              y={focusPoint[1] - 70}
              width={118}
              height={43}
              rx={14}
              fill="rgba(2,9,17,0.92)"
              stroke={focusColor}
            />
            <text
              x={focusPoint[0] + 94}
              y={focusPoint[1] - 41}
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
          padding: '10px 15px',
          borderRadius: 14,
          background: 'rgba(2,8,15,0.80)',
          color: '#D8E6F3',
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        日本が中央の世界地図
      </div>
      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 18,
          padding: '10px 15px',
          borderRadius: 14,
          background: 'rgba(2,8,15,0.80)',
          color: '#9FC4E2',
          fontSize: 17,
          fontWeight: 800,
        }}
      >
        色の面積＝利用シェア
      </div>
    </div>
  );
};

type LiveRanking = RankingRow & {
  currentRank: number;
  nextRank: number;
  position: number;
};

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
      currentRank,
      nextRank,
      position: mix(currentRank - 1, nextRank - 1, progress),
    };
  });
  const liveOrder = [...rows].sort((a, b) => b.share - a.share);
  const liveRank = new Map(liveOrder.map((row, index) => [row.entity, index + 1]));
  const maxShare = Math.max(1, ...rows.map((row) => row.share));
  const rowHeight = 72;
  const visibleHeight = data.config.rankingSize * rowHeight;

  return (
    <div style={{position: 'relative', height: visibleHeight, overflow: 'hidden'}}>
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
              transition: 'none',
              borderRadius: 19,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '48px 48px 1fr 150px',
              alignItems: 'center',
              gap: 12,
              padding: '0 18px',
              background:
                liveRank.get(row.entity) === 1
                  ? 'rgba(255,255,255,0.13)'
                  : 'rgba(255,255,255,0.055)',
              border:
                liveRank.get(row.entity) === 1
                  ? `1.5px solid ${entity.color}BB`
                  : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${(row.share / maxShare) * 100}%`,
                background: `linear-gradient(90deg, ${entity.color}46, ${entity.color}0A)`,
              }}
            />
            <div style={{zIndex: 1, fontSize: 25, fontWeight: 900}}>
              {liveRank.get(row.entity)}
            </div>
            <div style={{zIndex: 1}}>{browserBadge(row.entity, 39)}</div>
            <div style={{zIndex: 1, fontSize: 25, fontWeight: 900, whiteSpace: 'nowrap'}}>
              {entity.displayName}
            </div>
            <div style={{zIndex: 1, textAlign: 'right'}}>
              <span style={{fontSize: 31, fontWeight: 900}}>{row.share.toFixed(1)}</span>
              <span style={{fontSize: 17, marginLeft: 3, color: '#AFC0D3'}}>%</span>
              {data.config.showDelta && Math.abs(row.delta) >= 0.05 ? (
                <span
                  style={{
                    marginLeft: 7,
                    fontSize: 16,
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
}: {
  current: YearSnapshot;
  next: YearSnapshot;
  progress: number;
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
        marginTop: 14,
        minHeight: 146,
        borderRadius: 24,
        padding: '17px 20px 16px',
        background: 'linear-gradient(135deg, rgba(28,66,97,0.72), rgba(255,255,255,0.045))',
        border: '1px solid rgba(113,190,241,0.42)',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontSize: 25, fontWeight: 900}}>日本のブラウザ利用シェア</div>
        <div style={{fontSize: 17, color: '#AFC7DB', fontWeight: 800}}>1色ではなく割合で表示</div>
      </div>
      <div
        style={{
          marginTop: 12,
          height: 24,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 999,
          background: '#172334',
          border: '1px solid rgba(255,255,255,0.14)',
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
      <div style={{marginTop: 12, display: 'flex', gap: 24, alignItems: 'center'}}>
        {topThree.map((share) => (
          <div key={share.entity} style={{display: 'flex', alignItems: 'center', gap: 9}}>
            {browserBadge(share.entity, 34)}
            <div>
              <div style={{fontSize: 19, fontWeight: 900}}>{data.entities[share.entity].displayName}</div>
              <div style={{fontSize: 19, color: data.entities[share.entity].color, fontWeight: 900}}>
                {share.value.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EventBanner = ({snapshot, phase}: {snapshot: YearSnapshot; phase: number}) => {
  const event = data.config.showEvents ? snapshot.events[0] : undefined;
  if (!event) return null;
  const opacity = interpolate(phase, [0, 0.09, 0.78, 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: 24,
        minHeight: 91,
        borderRadius: 22,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        opacity,
        transform: `translateY(${(1 - opacity) * 18}px)`,
        background: 'linear-gradient(90deg, rgba(3,9,16,0.95), rgba(10,25,39,0.93))',
        border: '1px solid rgba(255,204,102,0.52)',
      }}
    >
      <div style={{fontSize: 32, color: '#FFD166'}}>◆</div>
      <div>
        <div style={{fontSize: 25, fontWeight: 900}}>{event.title}</div>
        <div style={{marginTop: 3, fontSize: 19, color: '#C9D6E3', fontWeight: 650}}>
          {event.description}
        </div>
      </div>
    </div>
  );
};

const Progress = ({ratio}: {ratio: number}) => (
  <div style={{marginTop: 15}}>
    <div style={{height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden'}}>
      <div
        style={{
          height: '100%',
          width: `${clamp(ratio) * 100}%`,
          borderRadius: 999,
          background: 'linear-gradient(90deg, #39A9F5, #34A853, #FFB000)',
          boxShadow: '0 0 14px rgba(81,199,255,0.65)',
        }}
      />
    </div>
    <div
      style={{
        marginTop: 7,
        display: 'grid',
        gridTemplateColumns: '90px 1fr 90px',
        alignItems: 'center',
        fontSize: 15,
        color: '#8199AF',
        fontWeight: 800,
      }}
    >
      <span>{data.config.startYear}年</span>
      <span style={{textAlign: 'center'}}>{data.config.sourceLabel}</span>
      <span style={{textAlign: 'right'}}>{data.config.endYear}年</span>
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
  const month = Math.min(12, Math.floor(phase * 12) + 1);
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
        padding: '42px 44px 34px',
        background: `radial-gradient(circle at 50% 28%, #102B43 0%, ${data.config.backgroundColor} 58%, #020408 100%)`,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{maxWidth: 700}}>
          <div style={{fontSize: 40, fontWeight: 900, letterSpacing: 0.2}}>{data.config.title}</div>
          <div style={{marginTop: 6, fontSize: 21, color: '#D3E2EF', fontWeight: 800}}>
            {data.config.subtitle}
          </div>
          <div style={{marginTop: 5, fontSize: 17, color: '#75BDE8', fontWeight: 750}}>
            {data.config.metricLabel}
          </div>
        </div>
        <div style={{textAlign: 'right', minWidth: 250}}>
          <div style={{fontSize: 68, lineHeight: 0.96, fontWeight: 900, letterSpacing: -3}}>
            {current.year}年
          </div>
          <div style={{marginTop: 8, fontSize: 28, color: '#FFD277', fontWeight: 900}}>
            {month}月
          </div>
        </div>
      </div>

      <div style={{position: 'relative', marginTop: 18}}>
        <WorldMap current={current} next={next} progress={progress} phase={phase} />
        <EventBanner snapshot={current} phase={phase} />
      </div>

      <div style={{marginTop: 17}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10}}>
          <div style={{fontSize: 22, fontWeight: 900, color: '#D1DFEB'}}>
            主要48か国の平均利用シェア
          </div>
          <div style={{fontSize: 18, color: leaderColor, fontWeight: 900}}>
            現在の首位：{leader ?? '集計中'}
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
  const marks = ['Internet Explorer', 'Firefox', 'Chrome', 'Safari', 'Edge'];
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
      <div style={{fontSize: 28, color: '#77CFFF', fontWeight: 900, letterSpacing: 3}}>
        世界ブラウザ利用シェア
      </div>
      <div
        style={{
          marginTop: 25,
          fontSize: 66,
          lineHeight: 1.25,
          fontWeight: 900,
          whiteSpace: 'pre-line',
          transform: `scale(${0.84 + entrance * 0.16})`,
          textShadow: '0 0 32px rgba(82,190,255,0.25)',
        }}
      >
        {data.config.hookText ?? data.config.title}
      </div>
      <div style={{marginTop: 39, display: 'flex', gap: 18, justifyContent: 'center'}}>
        {marks.map((mark, index) => {
          const item = spring({frame: frame - index * 3, fps, config: {damping: 14, stiffness: 130}});
          return (
            <div key={mark} style={{transform: `translateY(${(1 - item) * 36}px) scale(${item})`, opacity: item}}>
              {browserBadge(mark, 74)}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 44,
          padding: '22px 30px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.16)',
        }}
      >
        <div style={{fontSize: 29, fontWeight: 900}}>国の中を複数の色で表示</div>
        <div style={{marginTop: 9, fontSize: 23, color: '#BED0E0', fontWeight: 750}}>
          色の境界がじわじわ動き、利用シェアの変化を表します
        </div>
      </div>
      <div style={{marginTop: 38, fontSize: 34, fontWeight: 900}}>
        {data.config.startYear}年 <span style={{color: '#6ABDEB'}}>→</span> {data.config.endYear}年
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
        padding: '20px 18px',
        borderRadius: 23,
        background: `linear-gradient(145deg, ${config.color}28, rgba(255,255,255,0.05))`,
        border: `1px solid ${config.color}88`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 11}}>
        {browserBadge(entity, 43)}
        <div style={{fontSize: 23, fontWeight: 900}}>{config.displayName}</div>
      </div>
      <div style={{marginTop: 15, fontSize: 27, fontWeight: 900}}>
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
  return (
    <AbsoluteFill
      style={{
        color: '#FFFFFF',
        fontFamily,
        padding: '44px 46px 34px',
        background: `radial-gradient(circle at 50% 30%, #12314B, ${data.config.backgroundColor} 62%, #010307)`,
      }}
    >
      <div style={{textAlign: 'center', transform: `translateY(${(1 - reveal) * 26}px)`, opacity: reveal}}>
        <div style={{fontSize: 25, color: '#76CDFF', fontWeight: 900}}>最終結果</div>
        <div style={{marginTop: 8, fontSize: 51, fontWeight: 900}}>16年間で世界はこう変わった</div>
      </div>
      <div style={{marginTop: 22}}>
        <WorldMap current={last} next={last} progress={0} phase={0.7} />
      </div>
      <div style={{marginTop: 18, display: 'flex', gap: 14}}>
        <SummaryCard
          entity="Internet Explorer"
          before={rankingShare(first, 'Internet Explorer')}
          after={rankingShare(last, 'Internet Explorer')}
        />
        <SummaryCard
          entity="Chrome"
          before={rankingShare(first, 'Chrome')}
          after={rankingShare(last, 'Chrome')}
        />
      </div>
      <div style={{marginTop: 24, textAlign: 'center'}}>
        <div style={{fontSize: 30, fontWeight: 900}}>{data.config.endingQuestion}</div>
        <div style={{marginTop: 16, display: 'flex', justifyContent: 'center', gap: 18}}>
          {[data.config.endingOptionA, data.config.endingOptionB]
            .filter(Boolean)
            .map((option) => (
              <div
                key={option}
                style={{
                  minWidth: 245,
                  padding: '14px 24px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  fontSize: 23,
                  fontWeight: 900,
                }}
              >
                {option}
              </div>
            ))}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 20, left: 38, right: 38, textAlign: 'center', fontSize: 14, color: '#71879C'}}>
        {data.config.sourceLabel}｜年次代表値の間は月単位で補間しています
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
  const intervalCount = Math.max(1, years.length - 1);
  const mainFrames = intervalCount * yearFrames;
  const mainStart = introFrames;
  const outroStart = mainStart + mainFrames;

  if (frame < introFrames) return <Intro frame={frame} fps={fps} />;
  if (frame >= outroStart) return <Outro frame={frame} startFrame={outroStart} fps={fps} />;

  const relativeFrame = Math.max(0, frame - mainStart);
  const index = Math.min(intervalCount - 1, Math.floor(relativeFrame / yearFrames));
  const phase = (relativeFrame % yearFrames) / yearFrames;
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
