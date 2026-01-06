# 快速开始指南

5 分钟部署 Polymarket Monitor Bot 到 Supabase！

## 前置要求

- ✅ Supabase 账号（[免费注册](https://supabase.com)）
- ✅ Telegram Bot Token（通过 @BotFather 创建）
- ✅ Node.js 和 npm

## 步骤 1：安装 Supabase CLI

```bash
npm install -g supabase
```

## 步骤 2：克隆项目

```bash
git clone https://github.com/defiwizard1002/polymarket-bot-supabase.git
cd polymarket-bot-supabase
```

## 步骤 3：运行部署脚本

```bash
./deploy.sh
```

脚本会提示你输入：
- Supabase Project Reference（在项目设置中找到）
- Telegram Bot Token
- Telegram Chat ID

## 步骤 4：设置数据库

1. 打开 [Supabase Dashboard](https://app.supabase.com)
2. 进入你的项目
3. 点击 **SQL Editor**
4. 复制 `setup-database.sql` 的内容
5. **重要：** 替换以下占位符：
   ```sql
   '<YOUR_PROJECT_URL>'  -- 替换为你的项目 URL
   '<YOUR_ANON_KEY>'     -- 替换为你的 Anon Key
   ```
6. 点击 **Run** 执行

## 步骤 5：测试

在 Telegram 中向你的机器人发送 `/start`

## 完成！🎉

你的 Bot 现在已经在 Supabase 上运行了！

### 验证部署

```bash
# 查看 Edge Functions 日志
supabase functions logs telegram-webhook --follow

# 手动触发监控测试
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/monitor-markets" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `/start` | 启动机器人 |
| `/status` | 查看运行状态 |
| `/config` | 查看配置 |
| `/setmin 2000` | 设置大单阈值为 $2000 |
| `/markets` | 查看监控的市场 |
| `/trades` | 查看最近大单 |

### 下一步

- 📖 阅读 [完整部署文档](DEPLOYMENT.md)
- 🔧 调整监控参数
- 📊 查看数据库中的数据

### 需要帮助？

- [GitHub Issues](https://github.com/defiwizard1002/polymarket-bot-supabase/issues)
- [Supabase 文档](https://supabase.com/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**提示：** Supabase 免费计划足够运行此 Bot，无需付费！
