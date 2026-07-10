export type EntityConfig = {
  displayName: string;
  color: string;
  priority: number;
};

export type VideoConfig = {
  title: string;
  subtitle: string;
  hookText?: string;
  metricLabel?: string;
  sourceLabel?: string;
  focusCountryCode?: string;
  focusCountryLabel?: string;
  endingQuestion?: string;
  endingOptionA?: string;
  endingOptionB?: string;
  startYear: number;
  endYear: number;
  secondsPerYear: number;
  introSeconds: number;
  outroSeconds: number;
  transitionRatio: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
  rankingSize: number;
  noDataColor: string;
  backgroundColor: string;
  showEvents: boolean;
  showDelta: boolean;
};

export type CountryWinner = {
  countryCode: string;
  countryName: string;
  numericCode: string;
  entity: string;
  value: number;
  previousEntity: string | null;
  changed: boolean;
};

export type RankingRow = {
  entity: string;
  count: number;
  delta: number;
  rank: number;
};

export type EventItem = {
  year: number;
  title: string;
  description: string;
};

export type YearSnapshot = {
  year: number;
  countries: CountryWinner[];
  ranking: RankingRow[];
  leader: string | null;
  previousLeader: string | null;
  leaderChanged: boolean;
  gainedByEntity: Record<string, number>;
  lostByEntity: Record<string, number>;
  events: EventItem[];
};

export type PreparedVideoData = {
  config: VideoConfig;
  entities: Record<string, EntityConfig>;
  years: YearSnapshot[];
  warnings: string[];
  generatedAt: string;
};
