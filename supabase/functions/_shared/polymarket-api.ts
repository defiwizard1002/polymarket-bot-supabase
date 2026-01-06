// Polymarket API client for Edge Functions

import type { MarketEvent, Trade } from './types.ts';

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const CLOB_API_URL = 'https://clob.polymarket.com';

interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  clobTokenIds: string;
  active: boolean;
  closed: boolean;
}

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  active: boolean;
  closed: boolean;
  markets: GammaMarket[];
}

interface ClobTrade {
  id: string;
  taker_order_id: string;
  market: string;
  asset_id: string;
  side: string;
  size: string;
  price: string;
  status: string;
  match_time: string;
  last_update: string;
  fee_rate_bps: string;
}

function parseJsonArray(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function transformEvent(event: GammaEvent): MarketEvent {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    active: event.active,
    closed: event.closed,
    markets: event.markets.map((m) => ({
      id: m.id,
      conditionId: m.conditionId,
      slug: m.slug,
      question: m.question,
      outcomes: parseJsonArray(m.outcomes),
      outcomePrices: parseJsonArray(m.outcomePrices),
      clobTokenIds: parseJsonArray(m.clobTokenIds),
      active: m.active,
    })),
  };
}

function transformTrade(trade: ClobTrade): Trade {
  return {
    id: trade.id,
    takerOrderId: trade.taker_order_id,
    market: trade.market,
    assetId: trade.asset_id,
    side: trade.side as 'BUY' | 'SELL',
    size: trade.size,
    price: trade.price,
    status: trade.status,
    matchTime: trade.match_time,
    lastUpdate: trade.last_update,
    feeRateBps: trade.fee_rate_bps,
  };
}

export async function getActiveEvents(limit: number = 100): Promise<MarketEvent[]> {
  const url = new URL(`${GAMMA_API_URL}/events`);
  url.searchParams.set('active', 'true');
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  const events: GammaEvent[] = await response.json();
  return events.map(transformEvent);
}

export async function getTrades(params: {
  market?: string;
  before?: string;
  limit?: number;
} = {}): Promise<Trade[]> {
  const url = new URL(`${CLOB_API_URL}/data/trades`);
  
  if (params.market) url.searchParams.set('market', params.market);
  if (params.before) url.searchParams.set('before', params.before);
  if (params.limit) url.searchParams.set('limit', params.limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch trades: ${response.statusText}`);
  }

  const trades: ClobTrade[] = await response.json();
  return trades.map(transformTrade);
}

export async function getMarketByConditionId(conditionId: string): Promise<MarketEvent | null> {
  const url = new URL(`${GAMMA_API_URL}/markets`);
  url.searchParams.set('condition_id', conditionId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const markets: GammaMarket[] = await response.json();
  if (!markets || markets.length === 0) return null;

  const market = markets[0];
  return {
    id: market.id,
    slug: market.slug,
    title: market.question,
    active: market.active,
    closed: market.closed,
    markets: [{
      id: market.id,
      conditionId: market.conditionId,
      slug: market.slug,
      question: market.question,
      outcomes: parseJsonArray(market.outcomes),
      outcomePrices: parseJsonArray(market.outcomePrices),
      clobTokenIds: parseJsonArray(market.clobTokenIds),
      active: market.active,
    }],
  };
}
