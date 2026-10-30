# YOURLS

[YOURLS](https://yourls.org/) (Your Own URL Shortener) is a self-hosted link
shortener, open source (MIT), written in PHP. This integration brings it into
Gladys: your YOURLS becomes a device with its number of links, its clicks, the
clicks of its most clicked link and the clicks of the links you choose to
follow. Scenes can react when a followed link passes a round number of clicks,
shorten an address and send the short link on, or read the clicks of any
link; a dashboard widget lists the most clicked links.

Tested against a real self-hosted YOURLS 1.10.6 (official Docker image,
MariaDB); feedback welcome on
[the issues](https://github.com/guim31/gladys-yourls/issues).

## What you need

- Gladys Assistant 5.1.0 or later.
- A YOURLS (version 1.5 or later) reachable from the Gladys machine, on your
  network or on the Internet.
- Its **signature token**, or a username and password of its admin.

At each refresh the integration sends one request (the totals and the ten most
clicked links), plus one per followed link: 11 requests at most. YOURLS sets no
quota on its API.

## Getting started

### 1. Find the signature token

In the YOURLS admin, open the **Tools** page: the "Secure passwordless API
call" part shows your signature token (a series of letters and digits). It
lets the integration use the API without your password. Without it, the
integration can use a username and password of the admin.

### 2. Configure the integration

In Gladys, open **Integrations → YOURLS → Configuration**:

- **YOURLS address**: the address of your YOURLS, the one your short links
  use, for example `https://sho.rt` or `http://192.168.1.10:8080/s`. An
  address copied from the admin (`/admin/`) or the API (`/yourls-api.php`) is
  understood; without `http://`, `https://` is used.
- **Signature token**: the token of step 1; or leave it empty and fill in
  **Username (without token)** and **Password (without token)**.
- **Links to follow**: the keywords of the short links to follow, separated by
  commas, for example `news, menu` (10 at most; a full short address works
  too). Each one becomes a feature and can fire "Click milestone".
- **Refresh interval**: 1, 5 (by default) or 15 minutes.
- **Language of the names**: the language of the feature names, set when the
  device is added, and of the scene action errors.

**Test the connection** reads YOURLS and answers with its version, the number
of links and of clicks, and the keywords not found.

### 3. Add the device

Open the **Discover** tab of the integration and add the YOURLS device. After
changing the links to follow, the tab offers to update the device.

## The device

| Feature                | What it shows                                                     |
| ---------------------- | ----------------------------------------------------------------- |
| Reachable              | 1 when YOURLS answers, 0 after two failed reads in a row          |
| Short links            | the short links of the database                                   |
| Clicks                 | the clicks of every link                                          |
| Clicks of the top link | the clicks of the most clicked link                               |
| Most clicked link      | the keyword of the most clicked link, `-` without any link        |
| `Clicks: news`         | the clicks of a followed link (here `news`), one per followed one |

The figures are those of YOURLS: every click, bots included (YOURLS does not
tell them apart).

## Dashboard

The **YOURLS links** widget shows the clicks and the links in all, then the most
clicked links with their clicks. The **Refresh** button reads YOURLS again. Its settings:

- **Links shown** (5 or 10);
- **Show the totals**;
- **Show the Refresh button**.

## Scenes

### Triggers

- **Click milestone**: a followed link passes a round number of clicks: 10, 25,
  50, 100, 250, 500, 1,000, 2,500… up to 1,000,000. Filters: the keyword (empty:
  any followed link) and the milestone (empty: any). Variables: keyword, short
  address, target address, title, clicks, milestone. Each milestone fires once,
  even when several are passed between two reads, or while Gladys was stopped.

### Actions

- **Shorten an address**: creates a short link in YOURLS. Fields: the address
  (it must start with `http://` or `https://`; scene variables are welcome),
  a keyword and a title (optional). Results: keyword, short address, target
  address, title, clicks, and "new link" (no when YOURLS already knew the
  address: it gives its existing link, as YOURLS does by default).
- **Read a short link**: reads a link by its keyword (or its short address),
  followed or not. Results: keyword, short address, target address, title,
  clicks.

### Scene ideas

- A message when the link of your listing reaches 100 clicks: trigger **Click
  milestone** with the keyword and the milestone 100.
- Every morning, **Shorten an address** on the page of the menu of the day,
  then send the short address by Telegram.
- Every Sunday evening, **Read a short link** on your newsletter and send its
  clicks.

## Troubleshooting

- **"YOURLS does not answer"**: check the address and that Gladys can reach
  YOURLS (network, firewall, port).
- **"signature token or password refused"**: copy the token again from the
  Tools page (it changes with the YOURLS cookie key), or check the username
  and password.
- **"no YOURLS API at this address"**: the address points to something else:
  use the address of the short links, with the sub-directory of YOURLS if any.
- **"the address redirects"**: enter the `https://` address directly.
- **"certificate refused"**: the HTTPS certificate is self-signed or expired: use
  the `http://` address on your local network, or a trusted certificate.
- A followed keyword not found has no value; **Test the connection** names it.
- The logs never show the token, the password or the visitors.

## Limits

- The links to follow are typed in the configuration (10 at most), not picked
  from a list: YOURLS can hold thousands of links.
- YOURLS counts every click, bots and link previews included.
- With a YOURLS that keeps one link per address (the default), shortening a
  known address gives its existing link, even with another keyword.
- The device shows the instance; the history of a link starts when you follow
  it.
