"""Server-side PIN security for Lotus Digicode."""

from __future__ import annotations

from base64 import b64decode, b64encode
from collections import defaultdict, deque
from dataclasses import dataclass
import hashlib
import hmac
import logging
import os
import time
from typing import Any

import voluptuous as vol

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.hashes import SHA256

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store

from .const import DOMAIN, LEGACY_DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.digicodes"
LEGACY_STORAGE_KEY = f"{LEGACY_DOMAIN}.digicodes"
PBKDF2_ITERATIONS = 600_000
MAX_PIN_LENGTH = 12
MAX_FAILURES = 5
FAILURE_WINDOW = 60.0
LOCK_SECONDS = 30.0
CHALLENGE_TTL = 30.0

MODE_PLAIN = "server_plain"
MODE_ENCRYPTED = "server_encrypted"
SERVER_MODES = {MODE_PLAIN, MODE_ENCRYPTED}


def _valid_pin(pin: str) -> bool:
    return bool(pin) and len(pin) <= MAX_PIN_LENGTH and pin.isdigit()


def _hash_pin(pin: str, salt: bytes, iterations: int = PBKDF2_ITERATIONS) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, iterations)


@dataclass(slots=True)
class AttemptState:
    failures: deque[float]
    locked_until: float = 0.0


class DigicodeSecurityManager:
    """Persist and validate Lotus Digicode PINs on the Home Assistant server."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY, private=True)
        self.legacy_store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, LEGACY_STORAGE_KEY, private=True)
        self.data: dict[str, Any] = {"digicodes": {}}
        self._private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self._attempts: dict[str, AttemptState] = defaultdict(
            lambda: AttemptState(deque())
        )
        self._challenges: dict[str, tuple[str, float]] = {}

    async def async_load(self) -> None:
        stored = await self.store.async_load()
        if isinstance(stored, dict) and isinstance(stored.get("digicodes"), dict):
            self.data = stored
            return

        legacy = await self.legacy_store.async_load()
        if isinstance(legacy, dict) and isinstance(legacy.get("digicodes"), dict):
            self.data = legacy
            await self.store.async_save(self.data)

    async def async_save(self) -> None:
        await self.store.async_save(self.data)

    def public_key_spki_b64(self) -> str:
        der = self._private_key.public_key().public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return b64encode(der).decode("ascii")

    def new_challenge(self, user_id: str) -> str:
        now = time.monotonic()
        self._challenges = {
            key: value for key, value in self._challenges.items() if value[1] > now
        }
        challenge = b64encode(os.urandom(24)).decode("ascii")
        self._challenges[challenge] = (user_id, now + CHALLENGE_TTL)
        return challenge

    def _consume_challenge(self, challenge: str, user_id: str) -> bool:
        stored = self._challenges.pop(challenge, None)
        return bool(stored and stored[0] == user_id and stored[1] >= time.monotonic())

    async def async_decrypt_pin(
        self, ciphertext_b64: str, challenge: str, user_id: str
    ) -> str:
        def _decrypt() -> str:
            ciphertext = b64decode(ciphertext_b64, validate=True)
            plaintext = self._private_key.decrypt(
                ciphertext,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=SHA256()),
                    algorithm=SHA256(),
                    label=None,
                ),
            )
            return plaintext.decode("utf-8")

        plaintext = await self.hass.async_add_executor_job(_decrypt)
        try:
            pin, embedded_challenge = plaintext.split("\n", 1)
        except ValueError as err:
            raise ValueError("Invalid encrypted PIN payload") from err
        if embedded_challenge != challenge or not self._consume_challenge(challenge, user_id):
            raise ValueError("Expired or invalid PIN challenge")
        return pin

    def get_entry(self, pin_id: str) -> dict[str, Any] | None:
        entry = self.data.get("digicodes", {}).get(pin_id)
        return entry if isinstance(entry, dict) else None

    async def async_set_pin(
        self,
        pin_id: str,
        mode: str,
        pin: str,
        action: dict[str, Any] | None,
    ) -> None:
        if mode not in SERVER_MODES:
            raise ValueError("Unsupported security mode")
        if not _valid_pin(pin):
            raise ValueError(f"PIN must contain 1 to {MAX_PIN_LENGTH} digits")

        entry: dict[str, Any] = {
            "mode": mode,
            "length": len(pin),
            "action": action if isinstance(action, dict) else {"action": "none"},
        }
        if mode == MODE_PLAIN:
            entry["pin"] = pin
        else:
            salt = os.urandom(32)
            digest = await self.hass.async_add_executor_job(
                _hash_pin, pin, salt, PBKDF2_ITERATIONS
            )
            entry.update(
                {
                    "salt": b64encode(salt).decode("ascii"),
                    "digest": b64encode(digest).decode("ascii"),
                    "iterations": PBKDF2_ITERATIONS,
                }
            )

        self.data.setdefault("digicodes", {})[pin_id] = entry
        self._attempts.pop(pin_id, None)
        await self.async_save()

    def status(self, pin_id: str) -> dict[str, Any]:
        entry = self.get_entry(pin_id)
        if not entry:
            return {"configured": False, "length": 0, "mode": None}
        return {
            "configured": True,
            "length": int(entry.get("length") or 0),
            "mode": entry.get("mode"),
            "server_action": self._is_server_action(entry.get("action")),
        }

    def _attempt_allowed(self, pin_id: str) -> tuple[bool, int]:
        now = time.monotonic()
        state = self._attempts[pin_id]
        while state.failures and state.failures[0] < now - FAILURE_WINDOW:
            state.failures.popleft()
        if state.locked_until > now:
            return False, max(1, int(state.locked_until - now + 0.999))
        if len(state.failures) >= MAX_FAILURES:
            state.locked_until = now + LOCK_SECONDS
            state.failures.clear()
            return False, int(LOCK_SECONDS)
        return True, 0

    def _register_failure(self, pin_id: str) -> None:
        state = self._attempts[pin_id]
        state.failures.append(time.monotonic())

    def _register_success(self, pin_id: str) -> None:
        self._attempts.pop(pin_id, None)

    async def async_validate(
        self,
        pin_id: str,
        mode: str,
        pin: str,
        *,
        track_attempts: bool = True,
    ) -> dict[str, Any]:
        entry = self.get_entry(pin_id)
        if not entry or entry.get("mode") != mode:
            return {"valid": False, "configured": False, "reason": "not_configured"}

        if track_attempts:
            allowed, retry_after = self._attempt_allowed(pin_id)
            if not allowed:
                return {
                    "valid": False,
                    "configured": True,
                    "locked": True,
                    "retry_after": retry_after,
                    "reason": "rate_limited",
                }

        if not _valid_pin(pin):
            if track_attempts:
                self._register_failure(pin_id)
            return {"valid": False, "configured": True, "reason": "invalid_format"}

        if mode == MODE_PLAIN:
            valid = hmac.compare_digest(str(entry.get("pin", "")), pin)
        else:
            try:
                salt = b64decode(str(entry.get("salt", "")), validate=True)
                expected = b64decode(str(entry.get("digest", "")), validate=True)
                iterations = int(entry.get("iterations") or PBKDF2_ITERATIONS)
            except (ValueError, TypeError):
                _LOGGER.error("Invalid encrypted PIN storage for digicode %s", pin_id)
                return {"valid": False, "configured": True, "reason": "storage_error"}
            actual = await self.hass.async_add_executor_job(_hash_pin, pin, salt, iterations)
            valid = hmac.compare_digest(expected, actual)

        if track_attempts:
            if valid:
                self._register_success(pin_id)
            else:
                self._register_failure(pin_id)
        return {"valid": valid, "configured": True, "reason": "" if valid else "incorrect"}

    @staticmethod
    def _is_server_action(action: Any) -> bool:
        if not isinstance(action, dict):
            return False
        kind = str(action.get("action") or "none")
        return kind in {"perform-action", "call-service", "toggle"}

    async def async_execute_action(
        self,
        action: dict[str, Any] | None,
        *,
        context,
    ) -> bool:
        if not isinstance(action, dict):
            return False
        kind = str(action.get("action") or "none")
        entity_id = action.get("entity")

        if kind == "toggle":
            if not entity_id:
                return False
            await self.hass.services.async_call(
                "homeassistant",
                "toggle",
                {},
                blocking=True,
                context=context,
                target={"entity_id": entity_id},
            )
            return True

        if kind not in {"perform-action", "call-service"}:
            return False

        service_name = str(action.get("perform_action") or action.get("service") or "").strip()
        if "." not in service_name:
            return False
        domain, service = service_name.split(".", 1)
        service_data = action.get("data") or action.get("service_data") or {}
        target = action.get("target") if isinstance(action.get("target"), dict) else None
        if target is None and entity_id:
            target = {"entity_id": entity_id}
        await self.hass.services.async_call(
            domain,
            service,
            service_data,
            blocking=True,
            context=context,
            target=target,
        )
        return True


def register_websocket_commands(hass: HomeAssistant, manager: DigicodeSecurityManager) -> None:
    """Register canonical and legacy Lotus Digicode WebSocket commands."""

    async def handle_status(connection, msg):
        connection.send_result(msg["id"], manager.status(msg["pin_id"]))

    async def handle_public_key(connection, msg):
        connection.send_result(
            msg["id"],
            {
                "algorithm": "RSA-OAEP-256",
                "spki": manager.public_key_spki_b64(),
                "challenge": manager.new_challenge(connection.user.id),
            },
        )

    async def handle_save(connection, msg):
        mode = msg["mode"]
        try:
            if mode == MODE_ENCRYPTED:
                ciphertext = msg.get("ciphertext")
                if not ciphertext:
                    raise ValueError("Encrypted PIN payload missing")
                challenge = str(msg.get("challenge") or "")
                pin = await manager.async_decrypt_pin(
                    ciphertext, challenge, connection.user.id
                )
            else:
                pin = str(msg.get("pin") or "")
            await manager.async_set_pin(msg["pin_id"], mode, pin, msg.get("action"))
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Unable to save Lotus Digicode PIN: %s", err)
            connection.send_error(msg["id"], "invalid_pin", str(err))
            return
        connection.send_result(msg["id"], manager.status(msg["pin_id"]))

    async def handle_validate(connection, msg):
        mode = msg["mode"]
        preview = bool(msg.get("preview", False))
        # Preview validation is an editor-only capability. Restrict it to
        # administrators so it cannot be abused as a normal-user rate-limit bypass.
        if preview and not connection.user.is_admin:
            connection.send_error(
                msg["id"], "unauthorized", "Admin required for PIN preview"
            )
            return
        try:
            if mode == MODE_ENCRYPTED:
                ciphertext = msg.get("ciphertext")
                if not ciphertext:
                    raise ValueError("Encrypted PIN payload missing")
                challenge = str(msg.get("challenge") or "")
                pin = await manager.async_decrypt_pin(
                    ciphertext, challenge, connection.user.id
                )
            else:
                pin = str(msg.get("pin") or "")
        except Exception:  # noqa: BLE001
            connection.send_result(
                msg["id"],
                {"valid": False, "configured": True, "reason": "decrypt_error"},
            )
            return

        result = await manager.async_validate(
            msg["pin_id"],
            mode,
            pin,
            track_attempts=not preview,
        )
        if result.get("valid"):
            if preview:
                # The editor can test the real PIN, but a successful preview must
                # never trigger the protected action.
                result["preview"] = True
                result["action_executed"] = False
                result["client_action"] = False
            else:
                entry = manager.get_entry(msg["pin_id"]) or {}
                action = entry.get("action")
                try:
                    executed = await manager.async_execute_action(
                        action if isinstance(action, dict) else None,
                        context=connection.context(msg),
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.error(
                        "Validated Digicode action failed for %s: %s",
                        msg["pin_id"],
                        err,
                    )
                    result["action_executed"] = False
                    result["client_action"] = False
                    result["action_error"] = True
                else:
                    result["action_executed"] = executed
                    result["client_action"] = not executed
        connection.send_result(msg["id"], result)

    def status_schema(command_type: str):
        return {
            vol.Required("type"): command_type,
            vol.Required("pin_id"): cv.string,
        }

    def public_key_schema(command_type: str):
        return {vol.Required("type"): command_type}

    def save_schema(command_type: str):
        return {
            vol.Required("type"): command_type,
            vol.Required("pin_id"): cv.string,
            vol.Required("mode"): vol.In(SERVER_MODES),
            vol.Optional("pin"): cv.string,
            vol.Optional("ciphertext"): cv.string,
            vol.Optional("challenge"): cv.string,
            vol.Optional("action"): dict,
        }

    def validate_schema(command_type: str):
        return {
            vol.Required("type"): command_type,
            vol.Required("pin_id"): cv.string,
            vol.Required("mode"): vol.In(SERVER_MODES),
            vol.Optional("pin"): cv.string,
            vol.Optional("ciphertext"): cv.string,
            vol.Optional("challenge"): cv.string,
            vol.Optional("preview", default=False): cv.boolean,
        }

    @websocket_api.websocket_command(status_schema("lotus_view_studio/digicode/status"))
    @websocket_api.async_response
    async def ws_status(hass, connection, msg):
        await handle_status(connection, msg)

    @websocket_api.websocket_command(public_key_schema("lotus_view_studio/digicode/public_key"))
    @websocket_api.async_response
    async def ws_public_key(hass, connection, msg):
        await handle_public_key(connection, msg)

    @websocket_api.websocket_command(save_schema("lotus_view_studio/digicode/save"))
    @websocket_api.require_admin
    @websocket_api.async_response
    async def ws_save(hass, connection, msg):
        await handle_save(connection, msg)

    @websocket_api.websocket_command(validate_schema("lotus_view_studio/digicode/validate"))
    @websocket_api.async_response
    async def ws_validate(hass, connection, msg):
        await handle_validate(connection, msg)

    # Compatibility protocol for cached 0.11.x frontend modules. These aliases
    # can be removed in a future major release after the migration window.
    @websocket_api.websocket_command(status_schema("lotus_visual/digicode/status"))
    @websocket_api.async_response
    async def ws_status_legacy(hass, connection, msg):
        await handle_status(connection, msg)

    @websocket_api.websocket_command(public_key_schema("lotus_visual/digicode/public_key"))
    @websocket_api.async_response
    async def ws_public_key_legacy(hass, connection, msg):
        await handle_public_key(connection, msg)

    @websocket_api.websocket_command(save_schema("lotus_visual/digicode/save"))
    @websocket_api.require_admin
    @websocket_api.async_response
    async def ws_save_legacy(hass, connection, msg):
        await handle_save(connection, msg)

    @websocket_api.websocket_command(validate_schema("lotus_visual/digicode/validate"))
    @websocket_api.async_response
    async def ws_validate_legacy(hass, connection, msg):
        await handle_validate(connection, msg)

    websocket_api.async_register_command(hass, ws_status)
    websocket_api.async_register_command(hass, ws_public_key)
    websocket_api.async_register_command(hass, ws_save)
    websocket_api.async_register_command(hass, ws_validate)
    websocket_api.async_register_command(hass, ws_status_legacy)
    websocket_api.async_register_command(hass, ws_public_key_legacy)
    websocket_api.async_register_command(hass, ws_save_legacy)
    websocket_api.async_register_command(hass, ws_validate_legacy)
