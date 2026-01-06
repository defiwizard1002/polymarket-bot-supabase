# Supabase 部署指南

本文档提供详细的 Supabase Edge Functions 部署步骤。

## 一、准备工作

### 1.1 创建 Telegram Bot

1. 在 Telegram 搜索 **@BotFather**
2. 发送 `/newbot` 创建机器人
3. 记录 Bot Token：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
4. 获取你的 Chat ID（通过 @userinfobot）

### 1.2 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 创建新项目
3. 记录以下信息：
   - Project URL: `https://xxxxx.supabase.co`
   - Anon Key: `eyJhbGciOi...`
   - Service Role Key: `eyJhbGciOi...`

### 1.3 安装 Supabase CLI

```bash
npm install -g supabase
```

## 二、初始化项目

### 2.1 克隆项目

```bash
git clone https://github.com/defiwizard1002/polymarket-bot-supabase.git
cd polymarket-bot-supabase
```

### 2.2 链接 Supabase 项目

```bash
# 登录
supabase login

# 链接项目
supabase link --project-ref your-project-ref
```

## 三、配置数据库

### 3.1 启用扩展

在 Supabase Dashboard → Database → Extensions 中启用：

- `pg_cron` - 定时任务
- `pg_net` - HTTP 请求
- `vault` - 密钥存储

### 3.2 创建数据库表

在 SQL Editor 中执行：

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
CREATE INDEX IF NOT EXISTS idx_large_trades_trade_id ON large_trades(trade_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
```

## 四、配置环境变量

### 4.1 在 Supabase Dashboard 配置

进入 **Edge Functions** → **Settings** → **Secrets**，添加：

```
TELEGRAM_BOT_TOKEN=8209376207:AAH_qInZLX0PdAxE0WRVkNHa34WCmGEr6HY
TELEGRAM_CHAT_ID=7275474625
FUNCTION_SECRET=your_random_secret_string
SUPABASE_URL=https://eeoanzxkwznmrivvymzc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.2 生成 FUNCTION_SECRET

```bash
openssl rand -hex 32
```

## 五、部署 Edge Functions

### 5.1 部署所有 Functions

```bash
# 部署 Telegram Webhook
supabase functions deploy telegram-webhook

# 部署市场监控
supabase functions deploy monitor-markets

# 部署交易监控
supabase functions deploy monitor-trades
```

### 5.2 验证部署

```bash
# 查看已部署的 Functions
supabase functions list
```

## 六、设置 Telegram Webhook

### 6.1 配置 Webhook URL

```bash
curl -X POST "https://api.telegram.org/bot8209376207:AAH_qInZLX0PdAxE0WRVkNHa34WCmGEr6HY/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://eeoanzxkwznmrivvymzc.supabase.co/functions/v1/telegram-webhook?secret=your_function_secret"
  }'
```

### 6.2 验证 Webhook

```bash
curl "https://api.telegram.org/bot8209376207:AAH_qInZLX0PdAxE0WRVkNHa34WCmGEr6HY/getWebhookInfo"
```

## 七、配置定时任务

### 7.1 存储密钥到 Vault

在 SQL Editor 中执行：

```sql
-- 存储项目 URL
SELECT vault.create_secret(
  'https://eeoanzxkwznmrivvymzc.supabase.co',
  'project_url'
);

-- 存储 Anon Key
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'anon_key'
);
```

### 7.2 创建 Cron 任务

```sql
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

### 7.3 验证 Cron 任务

```sql
-- 查看所有 Cron 任务
SELECT * FROM cron.job;

-- 查看最近的执行记录
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## 八、测试部署

### 8.1 测试 Telegram Webhook

在 Telegram 中向机器人发送 `/start`，应该收到欢迎消息。

### 8.2 手动触发监控

```bash
# 触发市场监控
curl -X POST "https://eeoanzxkwznmrivvymzc.supabase.co/functions/v1/monitor-markets" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 触发交易监控
curl -X POST "https://eeoanzxkwznmrivvymzc.supabase.co/functions/v1/monitor-trades" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 8.3 查看日志

```bash
# 实时查看日志
supabase functions logs telegram-webhook --follow
supabase functions logs monitor-markets --follow
supabase functions logs monitor-trades --follow
```

## 九、监控和维护

### 9.1 查看数据库状态

```sql
-- 查看市场数量
SELECT COUNT(*) FROM markets;

-- 查看最近的大单
SELECT * FROM large_trades 
ORDER BY timestamp DESC 
LIMIT 10;

-- 查看通知记录
SELECT * FROM notifications 
ORDER BY sent_at DESC 
LIMIT 10;
```

### 9.2 调整监控频率

```sql
-- 修改市场监控频率为每 10 分钟
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'monitor-markets-job'),
  schedule := '*/10 * * * *'
);

-- 修改交易监控频率为每 2 分钟
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'monitor-trades-job'),
  schedule := '*/2 * * * *'
);
```

### 9.3 暂停/恢复 Cron 任务

```sql
-- 暂停任务
SELECT cron.unschedule('monitor-markets-job');
SELECT cron.unschedule('monitor-trades-job');

-- 恢复任务（重新执行创建 Cron 任务的 SQL）
```

## 十、故障排除

### 10.1 Webhook 无响应

**问题：** Telegram 命令无响应

**解决方案：**
1. 检查 Webhook 设置：`curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. 验证 FUNCTION_SECRET 是否正确
3. 查看 Edge Function 日志：`supabase functions logs telegram-webhook`

### 10.2 定时任务未执行

**问题：** 没有收到新市场或大单通知

**解决方案：**
1. 检查 pg_cron 是否启用：`SELECT * FROM cron.job;`
2. 查看执行记录：`SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`
3. 验证 Vault 密钥：`SELECT name FROM vault.decrypted_secrets;`
4. 手动触发测试

### 10.3 API 请求失败

**问题：** 无法获取 Polymarket 数据

**解决方案：**
1. 检查 Polymarket API 状态
2. 查看 Edge Function 日志中的错误信息
3. 验证网络连接

### 10.4 数据库连接问题

**问题：** Edge Function 无法访问数据库

**解决方案：**
1. 验证 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
2. 检查数据库表是否已创建
3. 确认 RLS (Row Level Security) 策略

## 十一、更新和回滚

### 11.1 更新 Edge Function

```bash
# 修改代码后重新部署
supabase functions deploy telegram-webhook
```

### 11.2 回滚到之前版本

Supabase 会保留历史版本，可在 Dashboard 中回滚。

## 十二、成本估算

Supabase 免费计划包含：
- 500MB 数据库存储
- 2GB 文件存储
- 50MB Edge Functions 执行
- 50,000 月活跃用户

对于本项目：
- Edge Functions 调用：约 50,000 次/月（免费额度内）
- 数据库存储：< 100MB（免费额度内）
- 预计成本：**$0/月**（免费计划足够）

## 十三、安全建议

1. **保护密钥**
   - 不要将 Service Role Key 暴露在客户端
   - 使用 Vault 存储敏感信息
   - 定期轮换 FUNCTION_SECRET

2. **限制访问**
   - 使用 RLS 策略保护数据
   - 验证 Webhook 请求来源
   - 限制 API 调用频率

3. **监控异常**
   - 定期检查日志
   - 设置告警通知
   - 监控数据库大小

## 相关资源

- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [pg_cron 文档](https://github.com/citusdata/pg_cron)
- [grammY Bot Framework](https://grammy.dev)
- [Polymarket API 文档](https://docs.polymarket.com)
