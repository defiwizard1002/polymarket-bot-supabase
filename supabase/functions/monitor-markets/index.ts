// Monitor New Markets - Cron Job Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getActiveEvents } from '../_shared/polymarket-api.ts';
import { sendTelegramMessage, formatMarketNotification } from '../_shared/telegram.ts';

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

    console.log('Starting market monitoring...');

    // Fetch active events from Polymarket
    const events = await getActiveEvents(50);
    console.log(`Fetched ${events.length} events from Polymarket`);

    let newMarketsCount = 0;

    // Process each event
    for (const event of events) {
      for (const market of event.markets) {
        // Check if market already exists in database
        const { data: existingMarket } = await supabase
          .from('markets')
          .select('id')
          .eq('condition_id', market.conditionId)
          .single();

        if (!existingMarket) {
          // New market detected!
          console.log(`New market detected: ${market.slug}`);

          // Insert into database
          const { error: insertError } = await supabase
            .from('markets')
            .insert({
              condition_id: market.conditionId,
              slug: market.slug,
              question: market.question,
              outcomes: market.outcomes,
              outcome_prices: market.outcomePrices,
              clob_token_ids: market.clobTokenIds,
              active: market.active,
              monitored: true,
            });

          if (insertError) {
            console.error('Error inserting market:', insertError);
            continue;
          }

          // Send Telegram notification
          const message = formatMarketNotification({
            slug: market.slug,
            title: market.question,
            conditionId: market.conditionId,
            outcomes: market.outcomes,
          });

          await sendTelegramMessage(telegramToken, telegramChatId, message);
          
          // Log notification
          await supabase.from('notifications').insert({
            type: 'new_market',
            content: message,
            chat_id: telegramChatId,
            success: true,
          });

          newMarketsCount++;
        }
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      eventsChecked: events.length,
      newMarketsFound: newMarketsCount,
    };

    console.log('Market monitoring completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in market monitoring:', error);
    
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
