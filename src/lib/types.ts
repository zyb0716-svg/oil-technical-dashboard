export type PricePoint = {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close: number;
  ma20?: number | null;
  ma60?: number | null;
  ma120?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  bb_upper?: number | null;
  bb_middle?: number | null;
  bb_lower?: number | null;
  atr14?: number | null;
  pct_20d?: number | null;
  pct_60d?: number | null;
  pct_120d?: number | null;
};

export type Level = {
  price: number;
  type: string;
  strength: number;
  label: string;
};

export type ChannelPoint = {
  date: string;
  value: number;
};

export type BrentData = {
  symbol: 'Brent';
  source: string;
  data_status: string;
  last_updated: string;
  last_raw_data_date?: string | null;
  latest_data_date?: string | null;
  dropped_incomplete_latest_bar?: boolean;
  yahoo_close_mode?: 'early_fixed_close' | 'normal_daily_close' | string | null;
  early_fixed_close_used?: boolean;
  duplicated_top_date_detected?: boolean;
  discarded_realtime_top_row?: boolean;
  early_single_history_row_used?: boolean;
  timezone_for_daily_cutoff?: string | null;
  message_cn?: string;
  data: PricePoint[];
  levels: {
    supports: Level[];
    resistances: Level[];
  };
  channel: {
    window: number;
    slope: number | null;
    direction: 'uptrend' | 'downtrend' | 'sideways';
    upper: ChannelPoint[];
    middle: ChannelPoint[];
    lower: ChannelPoint[];
  };
};

export type ScoreBreakdownItem = {
  name: string;
  value: -1 | 0 | 1;
  explain: string;
};

export type AssetSignal = {
  latest_price: number | null;
  latest_data_date?: string | null;
  trend_score: number;
  trend_label: string;
  momentum_label: string;
  volatility_label: string;
  summary_cn: string;
  score_breakdown: ScoreBreakdownItem[];
};

export type Signals = {
  brent: AssetSignal;
};

export type Metadata = {
  last_updated: string;
  data_sources: string[];
  data_status: string;
  last_raw_data_date?: string | null;
  latest_data_date?: string | null;
  dropped_incomplete_latest_bar?: boolean;
  dropped_rows?: number;
  yahoo_close_mode?: 'early_fixed_close' | 'normal_daily_close' | string | null;
  early_fixed_close_used?: boolean;
  duplicated_top_date_detected?: boolean;
  discarded_realtime_top_row?: boolean;
  early_single_history_row_used?: boolean;
  timezone_for_daily_cutoff?: string | null;
  analysis_frequency?: string;
  uses_incomplete_intraday_bar?: boolean;
  status: string;
  errors?: string[];
  disclaimer_cn: string;
};
