// Telegram Webhook Handler for Polymarket Monitor Bot

import { Bot, webhookCallback } from 'https://deno.land/x/grammy@v1.8.3/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  formatConfigMessage,
  formatHelpMessage,
  sendTelegramMessage,
} from '../_shared/telegram.ts';

const bot = new Bot(Deno.env.get('TELEGRAM_BOT_TOKEN') || '');
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Command: /start
bot.command('start', async (ctx) => {
  await ctx.reply(
    '🤖 *欢迎使用 Polymarket Monitor Bot！*\n\n' +
    '我会帮你监控 Polymarket 的新市场和大单交易。\n\n' +
    '发送 /help 查看所有命令。',
    { parse_mode: 'Markdown' }
  );
});

// Command: /help
bot.command('help', async (ctx) => {
  await ctx.reply(formatHelpMessage(), { parse_mode: 'Markdown' });
});

// Command: /status
bot.command('status', async (ctx) => {
  try {
    const { count: marketCount } = await supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    const { count: tradeCount } = await supabase
      .from('large_trades')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    await ctx.reply(
      `📊 *Bot 运行状态*\n\n` +
      `✅ 状态: 在线\n` +
      `📈 监控市场数: ${marketCount || 0}\n` +
      `💰 24小时大单: ${tradeCount || 0}\n` +
      `⏰ 更新时间: ${new Date().toLocaleString()}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error fetching status:', error);
    await ctx.reply('❌ 获取状态失败，请稍后重试。');
  }
});

// Command: /config
bot.command('config', async (ctx) => {
  try {
    const { data: configs } = await supabase
      .from('bot_config')
      .select('*');

    if (!configs || configs.length === 0) {
      await ctx.reply('❌ 无法获取配置信息。');
      return;
    }

    const configMap = Object.fromEntries(
      configs.map((c) => [c.key, c.value])
    );

    const config = {
      min_bet_size: parseInt(configMap.min_bet_size || '1000'),
      monitor_all_markets: configMap.monitor_all_markets === 'true',
      polling_interval: parseInt(configMap.polling_interval || '5000'),
    };

    await ctx.reply(formatConfigMessage(config), { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching config:', error);
    await ctx.reply('❌ 获取配置失败，请稍后重试。');
  }
});

// Command: /setmin <amount>
bot.command('setmin', async (ctx) => {
  const args = ctx.message?.text?.split(' ');
  if (!args || args.length < 2) {
    await ctx.reply('❌ 用法: /setmin <金额>\n例如: /setmin 2000');
    return;
  }

  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount < 0) {
    await ctx.reply('❌ 请输入有效的金额（正整数）');
    return;
  }

  try {
    await supabase
      .from('bot_config')
      .update({ value: amount.toString() })
      .eq('key', 'min_bet_size');

    await ctx.reply(
      `✅ 最小大单阈值已更新为 $${amount}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error updating config:', error);
    await ctx.reply('❌ 更新配置失败，请稍后重试。');
  }
});

// Command: /markets
bot.command('markets', async (ctx) => {
  try {
    const { data: markets } = await supabase
      .from('markets')
      .select('*')
      .eq('monitored', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!markets || markets.length === 0) {
      await ctx.reply('📊 当前没有监控的市场。');
      return;
    }

    let message = `📊 *监控的市场* (最近 ${markets.length} 个)\n\n`;
    markets.forEach((m, i) => {
      message += `${i + 1}. ${m.question}\n`;
      message += `   🔗 \`${m.slug}\`\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching markets:', error);
    await ctx.reply('❌ 获取市场列表失败，请稍后重试。');
  }
});

// Command: /trades
bot.command('trades', async (ctx) => {
  try {
    const { data: trades } = await supabase
      .from('large_trades')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (!trades || trades.length === 0) {
      await ctx.reply('💰 最近没有检测到大单交易。');
      return;
    }

    let message = `💰 *最近大单交易* (${trades.length} 笔)\n\n`;
    trades.forEach((t, i) => {
      const value = t.price * t.size;
      message += `${i + 1}. ${t.side === 'BUY' ? '🟢' : '🔴'} $${t.size.toFixed(2)} @ ${(t.price * 100).toFixed(2)}%\n`;
      message += `   💎 Value: $${value.toFixed(2)}\n`;
      message += `   ⏰ ${new Date(t.timestamp).toLocaleString()}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching trades:', error);
    await ctx.reply('❌ 获取交易记录失败，请稍后重试。');
  }
});

const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    
    // Verify secret token
    const secret = url.searchParams.get('secret');
    if (secret !== Deno.env.get('FUNCTION_SECRET')) {
      return new Response('Unauthorized', { status: 401 });
    }

    return await handleUpdate(req);
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
