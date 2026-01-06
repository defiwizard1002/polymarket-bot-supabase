// Shared types for Polymarket Monitor Bot

export interface MarketEvent {
  id: string;
  slug: string;
  title: string;
  active: boolean;
  closed: boolean;
  markets: Market[];
}

export interface Market {
  id: string;
  conditionId: string;
  slug: string;
  question: string;
  outcomes: string[];
  outcomePrices: string[];
  clobTokenIds: string[];
  active: boolean;
}

export interface Trade {
  id: string;
  takerOrderId: string;
  market: string;
  assetId: string;
  side: 'BUY' | 'SELL';
  size: string;
  price: string;
  status: string;
  matchTime: string;
  lastUpdate: string;
  feeRateBps: string;
}

export interface BotConfig {
  min_bet_size: number;
  monitor_all_markets: boolean;
  polling_interval: number;
}

export interface DatabaseMarket {
  id: string;
  condition_id: string;
  slug: string;
  question: string;
  outcomes: string[];
  outcome_prices: string[];
  clob_token_ids: string[];
  active: boolean;
  monitored: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseTrade {
  id: string;
  trade_id: string;
  market_condition_id: string;
  asset_id: string;
  side: string;
  price: number;
  size: number;
  timestamp: string;
  notified: boolean;
  created_at: string;
}
