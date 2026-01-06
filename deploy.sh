#!/bin/bash

# Polymarket Monitor Bot - Supabase Deployment Script
# This script automates the deployment process

set -e

echo "🚀 Polymarket Monitor Bot - Supabase Deployment"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Get project reference
read -p "Enter your Supabase project reference (e.g., eeoanzxkwznmrivvymzc): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference is required"
    exit 1
fi

echo ""
echo "📦 Linking to Supabase project..."
supabase link --project-ref "$PROJECT_REF"

echo ""
echo "🔧 Deploying Edge Functions..."
echo ""

# Deploy telegram-webhook
echo "📤 Deploying telegram-webhook..."
supabase functions deploy telegram-webhook --no-verify-jwt

# Deploy monitor-markets
echo "📤 Deploying monitor-markets..."
supabase functions deploy monitor-markets --no-verify-jwt

# Deploy monitor-trades
echo "📤 Deploying monitor-trades..."
supabase functions deploy monitor-trades --no-verify-jwt

echo ""
echo "✅ All Edge Functions deployed successfully!"
echo ""

# Get environment variables
echo "🔐 Setting up environment variables..."
echo ""

read -p "Enter your Telegram Bot Token: " TELEGRAM_BOT_TOKEN
read -p "Enter your Telegram Chat ID: " TELEGRAM_CHAT_ID
read -p "Enter a random secret for FUNCTION_SECRET (or press Enter to generate): " FUNCTION_SECRET

if [ -z "$FUNCTION_SECRET" ]; then
    FUNCTION_SECRET=$(openssl rand -hex 32)
    echo "Generated FUNCTION_SECRET: $FUNCTION_SECRET"
fi

echo ""
echo "📝 Setting secrets..."

# Set secrets
supabase secrets set TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" --project-ref "$PROJECT_REF"
supabase secrets set TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" --project-ref "$PROJECT_REF"
supabase secrets set FUNCTION_SECRET="$FUNCTION_SECRET" --project-ref "$PROJECT_REF"

echo ""
echo "✅ Secrets configured successfully!"
echo ""

# Get project URL and keys
echo "📋 Getting project details..."
PROJECT_URL="https://$PROJECT_REF.supabase.co"

echo ""
echo "🔗 Setting up Telegram Webhook..."
echo ""

WEBHOOK_URL="$PROJECT_URL/functions/v1/telegram-webhook?secret=$FUNCTION_SECRET"

curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\"}"

echo ""
echo ""
echo "✅ Telegram Webhook configured!"
echo ""

echo "================================================"
echo "🎉 Deployment completed successfully!"
echo "================================================"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Go to Supabase Dashboard SQL Editor"
echo "2. Execute the SQL scripts in DEPLOYMENT.md to:"
echo "   - Create database tables"
echo "   - Enable pg_cron, pg_net, vault extensions"
echo "   - Set up cron jobs"
echo ""
echo "3. Test your bot by sending /start to your Telegram bot"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "🔗 Project URL: $PROJECT_URL"
echo "🔗 GitHub: https://github.com/defiwizard1002/polymarket-bot-supabase"
echo ""
