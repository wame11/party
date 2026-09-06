# Hadley Wood Jewish Community website

Static website for Hadley Wood Jewish Community (Hadley Wood Shul / Hadley Wood Synagogue),
8 Lancaster Avenue, Hadley Wood, Barnet, EN4 0EX.

No build step. Plain HTML, CSS and a small JavaScript file, hosted on GitHub Pages behind Cloudflare.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Welcome |
| `rabbi.html` | Rabbi Toby & Rebbetzen Bracha Weiniger |
| `cheder.html` | Cheder (Hebrew school) |
| `hall-hire.html` | Hall hire |
| `community.html` | Community: Events, Book a Kiddush, Read my Haftorah, Bar & Bat Mitzvah, Hatzola HBS |
| `404.html` | Not-found page |

Shared header and footer are repeated in each file. Edit text directly in the HTML.

## Colours

The palette lives in CSS variables at the top of `css/styles.css`. Four palettes are included:

| Name | `data-palette` value | Feel |
| --- | --- | --- |
| Stone & Sage (default) | `stone` | Warm off-white, logo green accent, pomegranate red buttons |
| Soft Slate | `slate` | Cool light grey, muted teal accent |
| Warm Linen | `linen` | Cream, olive accent, terracotta secondary |
| Cloud & Charcoal | `mono` | Near-white and charcoal, logo green only |

Preview any of them by adding `?palette=slate` (or `linen`, `mono`, `stone`) to a page URL, or
`?palette-picker` to get on-screen buttons. To change the site default, edit the
`data-palette="stone"` attribute on the `<html>` tag of every page:

```sh
sed -i 's/data-palette="stone"/data-palette="slate"/' *.html
```

## Set the domain

Every page has a canonical URL and Open Graph tags pointing at `https://YOUR-DOMAIN` until you set it:

```sh
./set-domain.sh www.your-domain.co.uk
```

This also writes the `CNAME` file GitHub Pages needs.

## Deploy on GitHub Pages

1. Merge this branch into `main`.
2. On GitHub: **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
3. Under **Custom domain** enter your domain (e.g. `www.your-domain.co.uk`), save, and tick **Enforce HTTPS** once the certificate is issued (a few minutes after DNS is in place).

The `.nojekyll` file stops GitHub running Jekyll on the files.

## Connect the domain in Cloudflare

DNS records to add in the Cloudflare dashboard (**DNS → Records**), or via the API below.

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| CNAME | `www` | `wame11.github.io` | DNS only |

Keep the records **DNS only** (grey cloud) until GitHub shows the certificate as issued and
"Enforce HTTPS" is on. After that you can switch them to Proxied (orange cloud) if you like, and
set **SSL/TLS → Overview** to **Full**.

### Using the Cloudflare API

You need an API token with `Zone.DNS: Edit` permission for the zone, and the Zone ID
(shown on the domain's Overview page).

```sh
export CF_TOKEN="your-api-token"
export ZONE_ID="your-zone-id"
export DOMAIN="your-domain.co.uk"

for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"$DOMAIN\",\"content\":\"$ip\",\"ttl\":1,\"proxied\":false}"
done

curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"www.$DOMAIN\",\"content\":\"wame11.github.io\",\"ttl\":1,\"proxied\":false}"
```

## Search engines

- Titles, descriptions, Open Graph tags and JSON-LD structured data (Synagogue / Organization,
  Person, Course, EventVenue) are on every page.
- `sitemap.xml` and `robots.txt` are at the root. After the domain is live, submit the sitemap in
  [Google Search Console](https://search.google.com/search-console) and create or claim the
  Google Business Profile for "Hadley Wood Jewish Community" with the same address and phone number.
