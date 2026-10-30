# YOURLS for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that brings your self-hosted [YOURLS](https://yourls.org/) link shortener into
Gladys.

- **YOURLS as a device**: reachable or not, number of short links, clicks in
  all, clicks and keyword of the most clicked link, and the clicks of the links
  you follow (10 at most).
- **Scene trigger**: a followed link passes a round number of clicks (10, 25,
  50, 100… up to 1,000,000).
- **Scene actions**: shorten an address (keyword and title optional) and hand
  the short link to the next actions; read the clicks of any link.
- **Dashboard widget**: the most clicked links, with the totals.
- Texts in English, French, German and Spanish.

Tested against a real self-hosted YOURLS 1.10.6 (official Docker image,
MariaDB). Feedback welcome on
[the issues](https://github.com/guim31/gladys-yourls/issues).

## Requirements

- Gladys Assistant 5.1.0 or later.
- A YOURLS (1.5 or later) reachable from Gladys, and its signature token (Tools
  page of the admin) or a username and password.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-yourls`. Then open its configuration, enter
the address of your YOURLS and its signature token, the keywords of the links
to follow, and add the device from the Discover tab.

The full guide: [docs/en.md](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)).

## How it works

At the chosen interval (5 minutes by default), the container calls
`yourls-api.php` with `action=stats&filter=top&limit=10` (the totals and the
ten most clicked links) and `action=url-stats` for each followed link. It
publishes the states when they change and fires "Click milestone" when a
followed link passes one; the clicks last seen are kept in `/data`, so a
restart neither repeats nor misses a milestone. The scene actions call
`action=shorturl` and `action=url-stats`. Every request is a POST: the token
or the password never appears in an address, and redirects are not followed,
so it is never sent to another host.

## Limits

- One YOURLS per configuration; 10 followed links at most, typed by keyword.
- YOURLS counts every click, bots and link previews included.
- A self-signed HTTPS certificate is not accepted (use `http://` on the local
  network).

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the project rules and the notes on the YOURLS
API.

## Credits

- [YOURLS](https://github.com/YOURLS/YOURLS) by Ozh Richard, Lester Chan and
  contributors (MIT): the API answers in `test/fixtures/yourls` come from its
  official Docker image, and the logo of the cover from its
  [repository](https://github.com/YOURLS/YOURLS).
- Built from the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js)
  and on the architecture of
  [gladys-shlink](https://github.com/guim31/gladys-shlink).

This integration is not affiliated with the YOURLS project.

## License

Apache-2.0, see [LICENSE](LICENSE).
