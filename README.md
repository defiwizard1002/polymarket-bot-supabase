# Polymarket Monitor Bot - Supabase Edition

基于 Supabase Edge Functions 的 Polymarket 监控 Telegram Bot，实现无服务器架构。

## 功能特性

- 🆕 **新市场监控** - 自动检测并通知新上线的 Polymarket 市场
- 💰 **大单追踪** - 实时监控超过阈值的大额交易
- ⚙️ **灵活配置** - 通过 Telegram 命令动态调整监控参数
- 🚀 **无服务器** - 基于 Supabase Edge Functions，无需维护服务器
- 📊 **数据持久化** - 使用 Supabase PostgreSQL 存储历史数据

## 架构设计

### Edge Functions

1. **telegram-webhook** - 处理 Telegram 用户命令
2. **monitor-markets** - 定时检查新市场（每 5 分钟）
3. **monitor-trades** - 定时检查大单交易（每 1 分钟）

### 数据库表

- `markets` - 存储监控的市场信息
- `large_trades` - 记录大单交易
- `bot_config` - Bot 配置参数
- `notifications` - 通知记录

## 快速开始

### 1. 前置要求

- Supabase 账号
- Telegram Bot Token
- Supabase CLI

```bash
# 安装 Supabase CLI
npm install -g supabase
```

### 2. 克隆项目

```bash
git clone https://github.com/defiwizard1002/polymarket-bot-supabase.git
cd polymarket-bot-supabase
```

### 3. 初始化 Supabase 项目

```bash
# 登录 Supabase
supabase login

# 链接到你的项目
supabase link --project-ref your-project-ref
```

### 4. 创建数据库表

在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL：

```sql
-- 市场表
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id TEXT UNIQUE NOT NULL,
  slug TEXT,
  question TEXT,
  outcomes JSONB,
  outcome_prices JSONB,
  clob_token_ids JSONB,
  active BOOLEAN DEFAULT true,
  monitored BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 大单交易表
CREATE TABLE IF NOT EXISTS large_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT UNIQUE,
  market_condition_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  side TEXT NOT NULL,
  price DECIMAL(10, 6) NOT NULL,
  size DECIMAL(20, 6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot 配置表
CREATE TABLE IF NOT EXISTS bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 通知记录表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  chat_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- 插入默认配置
INSERT INTO bot_config (key, value, description) VALUES
  ('min_bet_size', '1000', '最小大单阈值(USDC)'),
  ('monitor_all_markets', 'true', '是否监控所有市场'),
  ('polling_interval', '5000', '轮询间隔(毫秒)')
ON CONFLICT (key) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON markets(condition_id);
CREATE INDEX IF NOT EXISTS idx_markets_monitored ON markets(monitored) WHERE monitored = true;
CREATE INDEX IF NOT EXISTS idx_large_trades_market ON large_trades(market_condition_id);
CREATE INDEX IF NOT EXISTS idx_large_trades_timestamp ON large_trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
```

### 5. 配置环境变量

在 Supabase Dashboard 的 Edge Functions Settings 中添加以下环境变量：

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
FUNCTION_SECRET=your_random_secret
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 6. 部署 Edge Functions

```bash
# 部署所有 Functions
supabase functions deploy telegram-webhook
supabase functions deploy monitor-markets
supabase functions deploy monitor-trades
```

### 7. 设置 Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook?secret=<YOUR_SECRET>"
  }'
```

### 8. 设置定时任务

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 存储密钥到 Vault
SELECT vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
SELECT vault.create_secret('<YOUR_ANON_KEY>', 'anon_key');

-- 每 5 分钟检查新市场
SELECT cron.schedule(
  'monitor-markets-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:= (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/monitor-markets',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- 每 1 分钟检查大单交易
SELECT cron.schedule(
  'monitor-trades-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:= (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/monitor-trades',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

## Telegram 命令

- `/start` - 启动机器人
- `/help` - 显示帮助信息
- `/status` - 查看运行状态
- `/config` - 查看当前配置
- `/setmin <金额>` - 设置大单阈值
- `/markets` - 查看监控的市场
- `/trades` - 查看最近大单

## 项目结构

```
polymarket-bot-supabase/
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── types.ts
│   │   │   ├── polymarket-api.ts
│   │   │   └── telegram.ts
│   │   ├── telegram-webhook/
│   │   │   └── index.ts
│   │   ├── monitor-markets/
│   │   │   └── index.ts
│   │   └── monitor-trades/
│   │       └── index.ts
│   └── config.toml
├── README.md
└── DEPLOYMENT.md
```

## 监控和调试

### 查看 Edge Function 日志

```bash
# 实时查看日志
supabase functions logs telegram-webhook --follow
supabase functions logs monitor-markets --follow
supabase functions logs monitor-trades --follow
```

### 手动触发监控

```bash
# 触发市场监控
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/monitor-markets" \
  -H "Authorization: Bearer <YOUR_ANON_KEY>"

# 触发交易监控
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/monitor-trades" \
  -H "Authorization: Bearer <YOUR_ANON_KEY>"
```

### 查看 Cron 任务状态

```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## 故障排除

### Webhook 无响应

1. 检查 Telegram Webhook 是否正确设置
2. 验证 FUNCTION_SECRET 是否匹配
3. 查看 Edge Function 日志

### 定时任务未执行

1. 确认 pg_cron 扩展已启用
2. 检查 Vault 中的密钥是否正确
3. 查看 cron.job_run_details 表

### 通知未发送

1. 验证 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID
2. 检查 notifications 表中的错误信息
3. 确认机器人有发送消息的权限

## 版本历史

### v0.0.1 (2026-01-06)
- ✨ 初始版本
- 🚀 基于 Supabase Edge Functions 的无服务器架构
- 📊 新市场监控
- 💰 大单交易追踪
- ⚙️ Telegram 命令支持

## 许可证

MIT License

## 相关链接

- [Polymarket API 文档](https://docs.polymarket.com)
- [Supabase 文档](https://supabase.com/docs)
- [grammY Bot Framework](https://grammy.dev)
- [原 Node.js 版本](https://github.com/defiwizard1002/polymarket-monitor-bot)
