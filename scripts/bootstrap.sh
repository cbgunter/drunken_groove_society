#!/usr/bin/env bash
# Run this once when you have your Anthropic API key.
# Stores the key in AWS SSM, then triggers a backend redeploy via Cloud9.
set -euo pipefail

echo "Enter your Anthropic API key (input hidden):"
read -rs ANTHROPIC_KEY
echo ""

if [[ -z "$ANTHROPIC_KEY" ]]; then
  echo "No key entered. Exiting."
  exit 1
fi

echo "Updating SSM parameter /dgs/anthropic-api-key…"
aws ssm put-parameter \
  --name /dgs/anthropic-api-key \
  --value "$ANTHROPIC_KEY" \
  --type SecureString \
  --overwrite \
  --region us-east-1

echo ""
echo "✅ Key stored. Now redeploy the backend from Cloud9:"
echo ""
echo "  cd ~/drunken-groove-society"
echo "  git pull"
echo "  sam deploy --parameter-overrides AnthropicApiKey=\$(aws ssm get-parameter --name /dgs/anthropic-api-key --with-decryption --query Parameter.Value --output text)"
