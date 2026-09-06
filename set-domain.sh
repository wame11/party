#!/usr/bin/env sh
# Usage: ./set-domain.sh www.example.co.uk
# Replaces the YOUR-DOMAIN placeholder in every page, the sitemap and robots.txt,
# and writes the CNAME file GitHub Pages needs for a custom domain.
set -e
DOMAIN="$1"
if [ -z "$DOMAIN" ]; then echo "Usage: $0 your-domain.co.uk"; exit 1; fi
DOMAIN=$(echo "$DOMAIN" | sed -e 's#^https\?://##' -e 's#/$##')
for f in *.html sitemap.xml robots.txt; do
  sed -i.bak "s#https://YOUR-DOMAIN#https://$DOMAIN#g" "$f" && rm -f "$f.bak"
done
echo "$DOMAIN" > CNAME
echo "Done: site URL set to https://$DOMAIN and CNAME written."
