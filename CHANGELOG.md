# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-30

### Added

- YOURLS as a device: reachable, short links, clicks in all, clicks and keyword
  of the most clicked link, and the clicks of each followed link (up to 10,
  chosen by keyword).
- Scene trigger "Click milestone": a followed link passes 10, 25, 50, 100…
  clicks, once per milestone, even across a restart.
- Scene actions "Shorten an address" (keyword and title optional, the short
  address for the next actions) and "Read a short link".
- Dashboard widget: the most clicked links and the totals, with settings to
  show 5 or 10 links and hide the totals or the Refresh button.
- Signature token or username and password; texts and documentation in
  English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-yourls/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-yourls/releases/tag/v1.0.0
