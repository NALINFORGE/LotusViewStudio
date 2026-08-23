# Lotus View Studio

Lotus View Studio is a visual dashboard editing suite for Home Assistant.

Repository: [NALINFORGE/LotusViewStudio](https://github.com/NALINFORGE/LotusViewStudio)

## Installation with HACS

1. Open HACS in Home Assistant.
2. Add this repository as a custom repository of type **Integration**.
3. Install **Lotus View Studio**.
4. Restart Home Assistant.
5. Add the **Lotus View Studio** integration from **Settings > Devices & services**.

## Manual installation

Copy the `custom_components/lotus_view_studio` directory into the `custom_components` directory of your Home Assistant configuration, then restart Home Assistant.

## Repository structure

The Home Assistant integration is located in:

`custom_components/lotus_view_studio`

## Compatibility

Lotus View Studio keeps compatibility aliases for selected legacy `lotus_visual` resources and WebSocket commands so existing dashboards can transition without rewriting Lovelace card types immediately.

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

[Support NALINFORGE on Ko-fi](https://ko-fi.com/lotuslab)
