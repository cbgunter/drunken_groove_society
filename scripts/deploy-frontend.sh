#!/usr/bin/env bash
set -euo pipefail

STACK="drunken-groove-society"
REGION="us-east-1"

echo "📦 Fetching stack outputs…"

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo "  Bucket:   $BUCKET"
echo "  Dist ID:  $DIST_ID"
echo "  API:      $API_ENDPOINT"

echo ""
echo "🔨 Building frontend…"
cd "$(dirname "$0")/../frontend"
VITE_API_BASE_URL="$API_ENDPOINT" npm run build
cd ..

echo ""
echo "🚀 Syncing to S3…"
# Versioned assets (hashed filenames) — long cache
aws s3 sync frontend/dist "s3://$BUCKET" --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "index.html" \
  --region "$REGION"

# index.html — always revalidate
aws s3 cp frontend/dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --region "$REGION"

echo ""
echo "🌐 Invalidating CloudFront cache…"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --region "$REGION" \
  --output text

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)

echo ""
echo "✅ Deploy complete: $CF_URL"
