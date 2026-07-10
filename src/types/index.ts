export type EntityConfig = {
  displayName: string;
  mark?: string;
  color: string;
  priority: number;
  excludeFromRanking?: boolean;
};

export type VideoConfig = {
  title: string;
  displayTitle?: string;
  categoryTitle?: string;
  subtitle: string;
  hookText?: string;
  shareExplanation?: string;
  metricLabel?: string;
  rankingLabel?: string;
  rankingMode?: 'average-share' | 'gained-area';
  sourceLabel?: string;
  focusCountryCode?: string;
  focusCountryLabel?: string;
  focusFaction?: string;
  focusPanelTitle?: string;
  introEntities?: string[];
  summaryEntities?: string[];
  endingLessonTitle?: string;
  endingLessons?: string[];
  discussionPrompt?: string;
  endingQuestion?: string;
  endingOptionA?: string;
  endingOptionB?: string;
  mapCenterLongitude?: number;
  insetLeft?: number;
  insetTop?: number;
  eventHoldSeconds?: number;
  startYear: number;
  endYear: number;
  startPeriod?: string;
  endPeriod?: string;
  secondsPerPeriod?: number;
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

export type BrowserShare = {
  entity: string;
  value: number;
};

export type CountryWinner = {
  countryCode: string;
  countryName: string;
  numericCode: string;
  entity: string;
  value: number;
  weight: number;
  shares: BrowserShare[];
  previousEntity: string | null;
  changed: boolean;
};

export type RankingRow = {
  entity: string;
  share: number;
  delta: number;
  rank: number;
};

export type EventItem = {
  period?: string;
  year: number;
  month?: number;
  title: string;
  description: string;
};

export type YearSnapshot = {
  period?: string;
  periodLabel?: string;
  year: number;
  month?: number;
  countries: CountryWinner[];
  ranking: RankingRow[];
  leader: string | null;
  previousLeader: string | null;
  leaderChanged: boolean;
  changedCountries: number;
  events: EventItem[];
};

export type PreparedVideoData = {
  config: VideoConfig;
  entities: Record<string, EntityConfig>;
  years: YearSnapshot[];
  warnings: string[];
  baselinePeriod?: string;
  generatedAt: string;
};
