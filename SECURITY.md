# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- the **signature token**, or the **username and password**, of YOURLS, stored
  by Gladys in the integration configuration (never written to `/data`, never
  logged); they travel in the body of POST requests to the address configured
  only, never in an address, and redirects are not followed so they never reach
  another host;
- `/data/yourls-state.json`: the clicks last seen per followed link, for the
  milestone trigger (no secret, no visitor data);
- network: HTTP(S) requests to YOURLS, nothing else; no port is opened. The
  scene action "Shorten an address" creates links in YOURLS with the rights of
  the configured account.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and YOURLS itself.
