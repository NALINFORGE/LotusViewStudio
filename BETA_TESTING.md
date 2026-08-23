# Beta testing guide

Thank you for testing Lotus View Studio before its first stable public release.

The goal of the beta phase is to expose the integration to Home Assistant environments that differ from the maintainer's own setup and identify compatibility, migration, rendering and workflow problems that cannot be reproduced in a single test environment.

## What to test

Please focus on normal use rather than intentionally destructive stress testing. Useful areas include:

- clean installation through HACS as a custom repository;
- manual installation;
- migration from an existing Lotus Visual installation;
- creation and editing of Lotus View Studio dashboards;
- multiple views and tabs;
- layer creation, renaming, visibility and locking;
- card creation, duplication, deletion, moving and copy/paste workflows;
- Lotus Stack, Slider and Digicode behavior;
- conditional visibility;
- responsive rendering on desktop, tablet and phone;
- safe margins and background-image positioning;
- different Home Assistant themes;
- different interface languages;
- Firefox, Chromium-based browsers and Safari/WebKit when available.

## Before reporting a bug

1. Reproduce the problem at least once after a normal browser refresh.
2. Confirm the Lotus View Studio and Home Assistant versions.
3. Note whether the installation is fresh or migrated from Lotus Visual.
4. If the issue is visual, record the browser, operating system, device type, screen orientation and theme.
5. If possible, reduce the problem to the smallest dashboard/card configuration that still reproduces it.

## Reporting

Open a GitHub issue and choose **Bug report**. Please complete every field that applies.

A strong bug report contains:

- exact steps to reproduce;
- expected behavior;
- actual behavior;
- relevant Home Assistant or browser-console logs;
- screenshots or a short screen recording for visual problems;
- a minimal YAML/configuration example when relevant.

## Sensitive information

Before attaching logs, YAML or screenshots, remove or obscure sensitive data. In particular, never publish:

- Home Assistant access tokens;
- passwords;
- Digicode PINs or hashes that should remain private;
- API keys;
- private certificates or keys;
- externally accessible private URLs;
- personal information that is not required to reproduce the bug.

Entity IDs and dashboard names can also reveal information about a home. Redact them when they are not needed to understand the issue.

## Beta expectations

A beta release can contain regressions and may change before the stable release. Back up important Home Assistant configuration before testing updates. Avoid relying on a beta build as the only control path for safety-critical or access-control functions.

Bug fixes take priority over new features during the beta period. Feature requests are welcome, but they may be deferred until the beta is stable.
