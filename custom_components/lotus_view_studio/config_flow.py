"""Config flow for Lotus View Studio."""

from homeassistant import config_entries

from .const import DOMAIN


class LotusViewStudioConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a Lotus View Studio config flow."""

    VERSION = 1

    async def _async_create_single_entry(self, data=None):
        """Create the single Lotus View Studio entry."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title="Lotus View Studio", data=data or {})

    async def async_step_user(self, user_input=None):
        """Create Lotus View Studio from the integrations UI."""
        return await self._async_create_single_entry()

    async def async_step_import(self, import_data=None):
        """Create Lotus View Studio from the legacy lotus_visual bridge."""
        data = dict(import_data or {})
        data.pop("migrated_from", None)
        return await self._async_create_single_entry(data)
