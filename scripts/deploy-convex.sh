#!/bin/bash
# Convex Production Deployment Script
# Usage: ./scripts/deploy-convex.sh

set -e

echo "🚀 Convex Production Deployment"
echo "================================"

# Check if logged in
echo "Checking Convex authentication..."
npx convex whoami || {
    echo "Not logged in. Running convex login..."
    npx convex login
}

# Prompt for environment variables if not set
echo ""
echo "Setting production environment variables..."
echo "(Skip any that are already set by pressing Enter)"
echo ""

read -p "BETTER_AUTH_SECRET (leave empty to skip): " BETTER_AUTH_SECRET
if [ -n "$BETTER_AUTH_SECRET" ]; then
    npx convex env set BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET" --prod
fi

read -p "BETTER_AUTH_URL [https://workspace.inboundemail.com]: " BETTER_AUTH_URL
BETTER_AUTH_URL=${BETTER_AUTH_URL:-https://workspace.inboundemail.com}
npx convex env set BETTER_AUTH_URL "$BETTER_AUTH_URL" --prod

read -p "SITE_URL [https://workspace.inboundemail.com]: " SITE_URL
SITE_URL=${SITE_URL:-https://workspace.inboundemail.com}
npx convex env set SITE_URL "$SITE_URL" --prod

read -p "GOOGLE_CLIENT_ID (leave empty to skip): " GOOGLE_CLIENT_ID
if [ -n "$GOOGLE_CLIENT_ID" ]; then
    npx convex env set GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID" --prod
fi

read -p "GOOGLE_CLIENT_SECRET (leave empty to skip): " GOOGLE_CLIENT_SECRET
if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    npx convex env set GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET" --prod
fi

read -p "AUTUMN_SECRET_KEY (leave empty to skip): " AUTUMN_SECRET_KEY
if [ -n "$AUTUMN_SECRET_KEY" ]; then
    npx convex env set AUTUMN_SECRET_KEY "$AUTUMN_SECRET_KEY" --prod
fi

# Run auth setup for production
echo ""
echo "Running Better Auth setup for production..."
npx @convex-dev/auth --prod

# Deploy
echo ""
echo "Deploying Convex functions to production..."
npx convex deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Production URL will be shown above."
echo "Make sure to update NEXT_PUBLIC_CONVEX_URL in your Vercel/hosting environment."
