"""Per-user Lotus Visual frontend preferences."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.preferences"
SUPPORTED_LANGUAGE_MODES = {"auto", "fr", "en", "de", "it", "es", "pt", "zh", "ja", "ko", "th", "ru", "ar", "nl", "pl", "sv", "da", "nb", "fi", "cs"}


class LotusVisualPreferences:
    """Persist Lotus Visual preferences by Home Assistant user id."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, STORAGE_KEY, private=True
        )
        self.data: dict[str, Any] = {"users": {}}

    async def async_load(self) -> None:
        stored = await self.store.async_load()
        if isinstance(stored, dict) and isinstance(stored.get("users"), dict):
            self.data = stored

    def get_user(self, user_id: str) -> dict[str, Any]:
        raw = self.data.get("users", {}).get(user_id)
        language = raw.get("language") if isinstance(raw, dict) else "auto"
        if language not in SUPPORTED_LANGUAGE_MODES:
            language = "auto"
        return {"language": language}

    async def async_set_language(self, user_id: str, language: str) -> dict[str, Any]:
        if language not in SUPPORTED_LANGUAGE_MODES:
            raise ValueError("Unsupported Lotus Visual language")
        users = self.data.setdefault("users", {})
        if language == "auto":
            users.pop(user_id, None)
        else:
            users[user_id] = {"language": language}
        await self.store.async_save(self.data)
        return self.get_user(user_id)


def register_preference_websocket_commands(
    hass: HomeAssistant, manager: LotusVisualPreferences
) -> None:
    """Register per-user Lotus Visual preference commands."""

    @websocket_api.websocket_command(
        {vol.Required("type"): "lotus_visual/preferences/get"}
    )
    @websocket_api.async_response
    async def ws_get(hass, connection, msg):
        connection.send_result(msg["id"], manager.get_user(connection.user.id))

    @websocket_api.websocket_command(
        {
            vol.Required("type"): "lotus_visual/preferences/set",
            vol.Required("language"): vol.In(SUPPORTED_LANGUAGE_MODES),
        }
    )
    @websocket_api.async_response
    async def ws_set(hass, connection, msg):
        try:
            result = await manager.async_set_language(
                connection.user.id, str(msg["language"])
            )
        except ValueError as err:
            connection.send_error(msg["id"], "invalid_language", str(err))
            return
        connection.send_result(msg["id"], result)

    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_set)
