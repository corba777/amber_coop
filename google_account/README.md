# Google Cloud credentials for the Vertex AI provider (never commit JSON keys).
#
# On this machine the live ADC file is the sibling folder:
#   ../google_account/application_default_credentials.json
# (type: authorized_user — from `gcloud auth application-default login`)
#
# This repo mirrors it via symlink for local `node dist/server.js` runs:
#   google_account/application_default_credentials.json → ../../google_account/...
#
# Docker Compose mounts ../google_account at /app/google_account and sets
# GOOGLE_APPLICATION_CREDENTIALS to application_default_credentials.json.
#
# A classic service_account.json in the same folder also works.
# Fallback: ~/.config/gcloud/application_default_credentials.json
#   or VERTEX_USE_GCLOUD=1
