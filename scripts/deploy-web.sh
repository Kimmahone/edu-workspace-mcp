#!/usr/bin/env bash
set -euo pipefail
# Secrets are referenced by name, never embedded in command arguments or build files.
: "GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT"
: "WEB_APP_ORIGIN:?Set WEB_APP_ORIGIN to the final HTTPS origin"
: "WEB_SERVICE_ACCOUNT:?Set WEB_SERVICE_ACCOUNT to a dedicated runtime service account"
if [[ "${WEB_PUBLIC_ACCESS:-0}" != "1" ]]; then
  : "WEB_ALLOWED_EMAILS:?Set pilot emails, or WEB_PUBLIC_ACCESS=1 for public access"
fi
WEB_ALLOWED_EMAILS="${WEB_ALLOWED_EMAILS:-}"
: "WEB_OPERATOR:?Set WEB_OPERATOR to the operator name"
: "WEB_SUPPORT_EMAIL:?Set WEB_SUPPORT_EMAIL to the support email"
WEB_REGION="${WEB_REGION:-asia-northeast3}"
WEB_SERVICE="${WEB_SERVICE:-workspace-lab-v1-1}"
WEB_GEMINI_MODEL="${WEB_GEMINI_MODEL:-gemini-flash-latest}"
WEB_OPENAI_MODEL="${WEB_OPENAI_MODEL:-gpt-6-luna}"
WEB_FORMS_TEMPLATE_ID="${WEB_FORMS_TEMPLATE_ID:-}"
if [[ ! "$WEB_FORMS_TEMPLATE_ID" =~ ^[a-zA-Z0-9_-]*$ ]]; then
  echo "WEB_FORMS_TEMPLATE_ID must be a Google Forms file ID" >&2
  exit 1
fi
WEB_SECRET_REFS="APP_SECRET=edu-app-secret:latest,DATABASE_URL=edu-database-url:latest,GOOGLE_WEB_CLIENT_ID=edu-google-client-id:latest,GOOGLE_WEB_CLIENT_SECRET=edu-google-client-secret:latest,GEMINI_API_KEY=edu-gemini-key:latest"
if [[ "${WEB_ENABLE_GPT:-0}" == "1" ]]; then
  WEB_SECRET_REFS="$WEB_SECRET_REFS,OPENAI_API_KEY=edu-openai-key:latest"
fi
gcloud run deploy "$WEB_SERVICE" --project "$GOOGLE_CLOUD_PROJECT" --region "$WEB_REGION" \
  --source . --service-account "$WEB_SERVICE_ACCOUNT" --allow-unauthenticated \
  --port 8080 --cpu 2 --memory 2Gi --concurrency 8 --timeout 300 \
  --min-instances 0 --max-instances 3 \
  --set-env-vars "^|^APP_MODE=hosted|APP_ORIGIN=$WEB_APP_ORIGIN|AI_DAILY_LIMIT=20|GEMINI_MODEL=$WEB_GEMINI_MODEL|OPENAI_MODEL=$WEB_OPENAI_MODEL|ALLOWED_EMAILS=$WEB_ALLOWED_EMAILS|APP_OPERATOR=$WEB_OPERATOR|APP_SUPPORT_EMAIL=$WEB_SUPPORT_EMAIL|GOOGLE_FORMS_TEMPLATE_ID=$WEB_FORMS_TEMPLATE_ID" \
  --set-secrets "$WEB_SECRET_REFS"
