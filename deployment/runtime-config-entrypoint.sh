#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

DEPLOYMENT_MODE_RAW="${DEPLOYMENT_MODE:-managed}"
TENANCY_MODE_RAW="${TENANCY_MODE:-multi}"
ROOT_DOMAIN_RAW="${ROOT_DOMAIN:-hi5central.com}"
APP_URL_RAW="${APP_URL:-}"
API_URL_RAW="${API_URL:-}"

if [ -z "$API_URL_RAW" ]; then
  if [ "$TENANCY_MODE_RAW" = "single" ]; then
    API_URL_RAW="${APP_URL_RAW:-https://${ROOT_DOMAIN_RAW}}"
  else
    API_URL_RAW="https://api.${ROOT_DOMAIN_RAW}"
  fi
fi

DEPLOYMENT_MODE_VALUE="$(json_escape "$DEPLOYMENT_MODE_RAW")"
TENANCY_MODE_VALUE="$(json_escape "$TENANCY_MODE_RAW")"
ROOT_DOMAIN_VALUE="$(json_escape "$ROOT_DOMAIN_RAW")"
PRIMARY_TENANT_VALUE="$(json_escape "${PRIMARY_TENANT_SLUG:-demo-tenant}")"
APP_URL_VALUE="$(json_escape "$APP_URL_RAW")"
API_URL_VALUE="$(json_escape "$API_URL_RAW")"
PORTAL_URL_VALUE="$(json_escape "${PORTAL_URL:-}")"
RMM_URL_VALUE="$(json_escape "${RMM_URL:-}")"
MARKETING_URL_VALUE="$(json_escape "${MARKETING_URL:-}")"
DOWNLOADS_URL_VALUE="$(json_escape "${DOWNLOADS_URL:-}")"
TURN_URL_VALUE="$(json_escape "${TURN_URL:-}")"

cat > /srv/runtime-config.js <<EOF
window.__HI5_CONFIG__ = Object.freeze({
  deploymentMode: "${DEPLOYMENT_MODE_VALUE}",
  tenancyMode: "${TENANCY_MODE_VALUE}",
  rootDomain: "${ROOT_DOMAIN_VALUE}",
  primaryTenantSlug: "${PRIMARY_TENANT_VALUE}",
  appUrl: "${APP_URL_VALUE}",
  apiUrl: "${API_URL_VALUE}",
  portalUrl: "${PORTAL_URL_VALUE}",
  rmmUrl: "${RMM_URL_VALUE}",
  marketingUrl: "${MARKETING_URL_VALUE}",
  downloadsUrl: "${DOWNLOADS_URL_VALUE}",
  turnUrl: "${TURN_URL_VALUE}"
})
window.__HI5_API_BASE__ = window.__HI5_CONFIG__.apiUrl || window.location.origin
EOF

exec "$@"
