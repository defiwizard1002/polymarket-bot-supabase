// Telegram utilities for Edge Functions

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown'
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send Telegram message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

export function formatMarketNotification(market: {
  slug: string;
  title: string;
  conditionId: string;
  outcomes: string[];
}): string {
  return `🆕 *新市场上线！*

📊 *${market.title}*

🔗 Slug: \`${market.slug}\`
🆔 Condition ID: \`${market.conditionId}\`
📈 Outcomes: ${market.outcomes.join(', ')}

🌐 [查看市场](https://polymarket.com/event/${market.slug})`;
}

export function formatTradeNotification(trade: {
  market: string;
  side: string;
  size: string;
  price: string;
  timestamp: string;
}): string {
  const sizeNum = parseFloat(trade.size);
  const priceNum = parseFloat(trade.price);
  const value = sizeNum * priceNum;

  return `💰 *检测到大单交易！*

📊 Market: \`${trade.market}\`
${trade.side === 'BUY' ? '🟢' : '🔴'} Side: *${trade.side}*
💵 Size: $${sizeNum.toFixed(2)}
📈 Price: ${(priceNum * 100).toFixed(2)}%
💎 Value: $${value.toFixed(2)}
⏰ Time: ${new Date(trade.timestamp).toLocaleString()}`;
}

export function formatConfigMessage(config: {
  min_bet_size: number;
  monitor_all_markets: boolean;
  polling_interval: number;
}): string {
  return `⚙️ *当前配置*

💰 最小大单阈值: $${config.min_bet_size}
🔔 监控所有市场: ${config.monitor_all_markets ? '✅' : '❌'}
⏱️ 轮询间隔: ${config.polling_interval / 1000}秒`;
}

export function formatHelpMessage(): string {
  return `🤖 *Polymarket Monitor Bot 帮助*

*可用命令：*

/start - 启动机器人
/status - 查看运行状态
/config - 查看当前配置
/setmin <金额> - 设置大单阈值
/markets - 查看监控的市场
/trades - 查看最近大单
/help - 显示此帮助信息

*功能说明：*

• 自动监控 Polymarket 新市场
• 实时追踪大额交易
• 可自定义监控参数

📖 [项目文档](https://github.com/defiwizard1002/polymarket-monitor-bot)`;
}
