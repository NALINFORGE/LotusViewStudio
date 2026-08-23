# Lotus View Studio

Lotus View Studio is a visual dashboard editing suite for Home Assistant.

> **Beta testing** — Lotus View Studio is currently in its public beta phase. It has been tested by the maintainer, but wider testing across different Home Assistant installations, browsers, devices, themes and languages is still required before the first stable public release. Back up important configuration before testing and do not rely on a beta build as the only control path for safety-critical or access-control functions.

Repository: [NALINFORGE/LotusViewStudio](https://github.com/NALINFORGE/LotusViewStudio)

See [BETA_TESTING.md](BETA_TESTING.md) for the beta test scope and reporting guidance.

## Installation with HACS during beta

Lotus View Studio is not yet distributed through the default HACS catalog. Beta testers should install it as a custom repository:

1. Open HACS in Home Assistant.
2. Open the HACS menu and choose **Custom repositories**.
3. Add `https://github.com/NALINFORGE/LotusViewStudio`.
4. Select **Integration** as the repository type.
5. Install **Lotus View Studio**.
6. Restart Home Assistant.
7. Add **Lotus View Studio** from **Settings > Devices & services** if Home Assistant has not already created the integration entry.

When beta/pre-release versions are published, enable the HACS option to display beta versions if required by your HACS installation.

## Manual installation

Copy the `custom_components/lotus_view_studio` directory into the `custom_components` directory of your Home Assistant configuration, then restart Home Assistant.

## Beta feedback

Please use the GitHub issue forms instead of sending unstructured bug reports. For bugs, include the Lotus View Studio version, Home Assistant version, installation method, browser/app, operating system/device, interface language and theme when relevant.

Visual problems are much easier to diagnose with a screenshot or short screen recording. Configuration problems should include a minimal reproducible example when possible.

Before publishing logs, YAML or screenshots, remove access tokens, passwords, Digicode PINs, private keys, API keys, private URLs and unnecessary personal information.

## Repository structure

The Home Assistant integration is located in:

`custom_components/lotus_view_studio`

## Compatibility and migration

Lotus View Studio keeps compatibility aliases for selected legacy `lotus_visual` resources and WebSocket commands so existing dashboards can transition without rewriting Lovelace card types immediately.

If you are testing a migration from Lotus Visual, please explicitly mention this in any bug report. Fresh-install and migrated-install behavior are both important during the beta phase.

## License

Lotus View Studio is licensed under the **PolyForm Noncommercial License 1.0.0** (`PolyForm-Noncommercial-1.0.0`).

You may use, modify and redistribute Lotus View Studio for purposes permitted by that license. Commercial use is **not** granted by the public license.

If you want to integrate Lotus View Studio into a paid product or service, provide it as part of a paid Home Assistant installation, resell it, or otherwise use it commercially, you must obtain a separate written commercial license from the copyright holder(s).

Forks and derivative works do not receive additional commercial rights. See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for the detailed fork and commercial-use policy.

## Contributing

External contributions require acceptance of the [Contributor License Agreement](CLA.md). Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## Support

Use the [GitHub issue tracker](https://github.com/NALINFORGE/LotusViewStudio/issues) to report reproducible bugs or request enhancements.

If Lotus View Studio is useful to you and you would like to support continued development, testing and maintenance of NALINFORGE projects, you can support the project on Ko-fi:

[Support NALINFORGE on Ko-fi](https://ko-fi.com/nalinforge)
