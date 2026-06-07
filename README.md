# unfurl-worker

A Cloudflare Worker that extracts meta data from URLs.

## Unfurl

Extracts the title, description, and image from a URL's Open Graph tags.

### GET `/v0?url=<url>`

```json
$ curl --silent 'https://unfurl.willow.rest/v0?url=https://npmx.dev/blog/release/crystal-chronicle' | jq
{
  "url": "https://npmx.dev/blog/release/crystal-chronicle",
  "title": "npmx crystal chronicle",
  "description": "npmx 0.11 is out! This past month, npmx continued improving towards a beta milestone, focusing on performance, accessibility, and stability",
  "image": "https://npmx.dev/blog/og/release-crystal-chronicle.png",
  "standardSiteDocument": "at://did:plc:u5zp7npt5kpueado77kuihyz/site.standard.document/3mloz7vn22225"
}
```

#### Response

Returns the extracted meta as JSON.

| Field                  | Description                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `url`                  | The resolved URL (`og:url` or the request URL)                                                  |
| `title`                | `og:title` or `title`                                                                           |
| `description`          | `og:description` or `description`                                                               |
| `image`                | `og:image`                                                                                      |
| `standardSiteDocument` | [`site.standard.document`](https://standard.site/docs/verification/#discovery-hint) atproto uri |

## Errors

All errors are returned as JSON with an `error` field. For example:

```json
$ curl --silent 'https://unfurl.willow.rest/v0?url=invalid-url' | jq
{
  "error": "Invalid URL"
}
```
