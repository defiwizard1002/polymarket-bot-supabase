// Monitor Large Trades - Cron Job Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTrades } from '../_shared/polymarket-api.ts';
import { sendTelegramMessage, formatTradeNotification } from '../_shared/telegram.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID') || '';

const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_ANON_KEY') || '')) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('Starting trade monitoring...');

    // Get min_bet_size from config
    const { data: configData } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'min_bet_size')
      .single();

    const minBetSize = configData ? parseInt(configData.value) : 1000;
    console.log(`Min bet size: $${minBetSize}`);

    // Fetch recent trades from Polymarket
    const trades = await getTrades({ limit: 100 });
    console.log(`Fetched ${trades.length} trades from Polymarket`);

    let largeTradesCount = 0;

    // Process each trade
    for (const trade of trades) {
      const size = parseFloat(trade.size);
      const price = parseFloat(trade.price);
      const value = size * price;

      // Check if trade meets minimum size threshold
      if (size < minBetSize) {
        continue;
      }

      // Check if trade already exists in database
      const { data: existingTrade } = await supabase
        .from('large_trades')
        .select('id')
        .eq('trade_id', trade.id)
        .single();

      if (!existingTrade) {
        // New large trade detected!
        console.log(`Large trade detected: $${size.toFixed(2)} on ${trade.market}`);

        // Get market info
        const { data: marketData } = await supabase
          .from('markets')
          .select('condition_id')
          .eq('condition_id', trade.market)
          .single();

        // Insert into database
        const { error: insertError } = await supabase
          .from('large_trades')
          .insert({
            trade_id: trade.id,
            market_condition_id: trade.market,
            asset_id: trade.assetId,
            side: trade.side,
            price: price,
            size: size,
            timestamp: trade.matchTime,
            notified: true,
          });

        if (insertError) {
          console.error('Error inserting trade:', insertError);
          continue;
        }

        // Send Telegram notification
        const message = formatTradeNotification({
          market: trade.market,
          side: trade.side,
          size: trade.size,
          price: trade.price,
          timestamp: trade.matchTime,
        });

        await sendTelegramMessage(telegramToken, telegramChatId, message);
        
        // Log notification
        await supabase.from('notifications').insert({
          type: 'large_trade',
          content: message,
          chat_id: telegramChatId,
          success: true,
        });

        largeTradesCount++;
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      tradesChecked: trades.length,
      largeTradesFound: largeTradesCount,
      minBetSize: minBetSize,
    };

    console.log('Trade monitoring completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in trade monitoring:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
