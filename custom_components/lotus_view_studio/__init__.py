"""Lotus View Studio: visual dashboard editing suite for Home Assistant."""

from inspect import signature
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    BRAND_URL,
    DOMAIN,
    LEGACY_BRAND_URL,
    LEGACY_URL_BASE,
    MODULE_URL,
    PANEL_ICON,
    PANEL_PATH,
    PANEL_TITLE,
    URL_BASE,
)
from .digicode_security import DigicodeSecurityManager, register_websocket_commands
from .preferences import LotusVisualPreferences, register_preference_websocket_commands

_FRONTEND_DIR = Path(__file__).parent / "frontend"
_BRAND_DIR = Path(__file__).parent / "brand"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Lotus View Studio from YAML (no YAML configuration is required)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Lotus View Studio from a config entry."""
    if entry.title != PANEL_TITLE:
        hass.config_entries.async_update_entry(entry, title=PANEL_TITLE)

    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("digicode_security"):
        digicode_security = DigicodeSecurityManager(hass)
        await digicode_security.async_load()
        register_websocket_commands(hass, digicode_security)
        data["digicode_security"] = digicode_security
    if not data.get("preferences"):
        preferences = LotusVisualPreferences(hass)
        await preferences.async_load()
        register_preference_websocket_commands(hass, preferences)
        data["preferences"] = preferences
    if not data.get("static_registered"):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(URL_BASE, str(_FRONTEND_DIR), cache_headers=False),
                StaticPathConfig(BRAND_URL, str(_BRAND_DIR), cache_headers=False),
                # Compatibility aliases for browser caches / manually registered
                # resources from Lotus Visual releases prior to 0.12.0.
                StaticPathConfig(LEGACY_URL_BASE, str(_FRONTEND_DIR), cache_headers=False),
                StaticPathConfig(LEGACY_BRAND_URL, str(_BRAND_DIR), cache_headers=False),
            ]
        )
        data["static_registered"] = True

    frontend.add_extra_js_url(hass, MODULE_URL)

    panel_kwargs = {
        "hass": hass,
        "frontend_url_path": PANEL_PATH,
        "webcomponent_name": "lotus-visual-manager",
        "sidebar_title": PANEL_TITLE,
        "sidebar_icon": PANEL_ICON,
        "module_url": MODULE_URL,
        "require_admin": True,
    }

    # Home Assistant 2026.8 does not expose handle_safe_area on all builds.
    # Add it only when the installed panel_custom API supports it so the same
    # package remains compatible with both 2026.8 and newer frontend APIs.
    if "handle_safe_area" in signature(panel_custom.async_register_panel).parameters:
        panel_kwargs["handle_safe_area"] = True

    await panel_custom.async_register_panel(**panel_kwargs)

    data[entry.entry_id] = {"module_url": MODULE_URL}
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload Lotus View Studio."""
    frontend.async_remove_panel(hass, PANEL_PATH, warn_if_unknown=False)
    try:
        frontend.remove_extra_js_url(hass, MODULE_URL)
    except (KeyError, ValueError):
        pass
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True
