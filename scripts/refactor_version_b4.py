from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "lotus_view_studio"
FRONTEND = COMPONENT / "frontend"
PACKAGE_VERSION = "0.13.0b4"


def replace_required(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def prepend_once(path: Path, line: str) -> None:
    text = path.read_text(encoding="utf-8")
    if line not in text:
        text = line + text
    path.write_text(text, encoding="utf-8")


def update_manifest() -> None:
    path = COMPONENT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["version"] = PACKAGE_VERSION
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_const() -> None:
    path = COMPONENT / "const.py"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^VERSION\s*=.*\n", "", text, flags=re.MULTILINE)
    text = re.sub(r"^MODULE_URL\s*=.*\n", "", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")


def update_backend() -> None:
    path = COMPONENT / "__init__.py"
    text = path.read_text(encoding="utf-8")

    text = text.replace(
        "from inspect import signature\nfrom pathlib import Path\n",
        "import json\nfrom inspect import signature\nfrom pathlib import Path\n",
    )
    text = text.replace("    MODULE_URL,\n", "")

    old_dirs = (
        '_FRONTEND_DIR = Path(__file__).parent / "frontend"\n'
        '_BRAND_DIR = Path(__file__).parent / "brand"\n'
    )
    new_dirs = (
        '_COMPONENT_DIR = Path(__file__).parent\n'
        '_FRONTEND_DIR = _COMPONENT_DIR / "frontend"\n'
        '_BRAND_DIR = _COMPONENT_DIR / "brand"\n'
        '_MANIFEST_PATH = _COMPONENT_DIR / "manifest.json"\n\n\n'
        'def _package_version() -> str:\n'
        '    """Return the integration version declared by manifest.json."""\n'
        '    manifest = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))\n'
        '    version = str(manifest.get("version", "")).strip()\n'
        '    if not version:\n'
        '        raise ValueError("Lotus View Studio manifest.json does not declare a version")\n'
        '    return version\n'
    )
    if old_dirs not in text:
        raise RuntimeError("Frontend/brand directory block not found in __init__.py")
    text = text.replace(old_dirs, new_dirs)

    marker = "    data = hass.data.setdefault(DOMAIN, {})\n"
    version_setup = (
        marker
        + "    package_version = _package_version()\n"
        + '    versioned_url_base = f"{URL_BASE}/{package_version}"\n'
        + '    versioned_brand_url = f"{BRAND_URL}/{package_version}"\n'
        + '    module_url = f"{versioned_url_base}/lotus-visual.js"\n'
    )
    if marker not in text:
        raise RuntimeError("Setup data marker not found in __init__.py")
    text = text.replace(marker, version_setup, 1)

    old_static = """            [
                StaticPathConfig(URL_BASE, str(_FRONTEND_DIR), cache_headers=False),
                StaticPathConfig(BRAND_URL, str(_BRAND_DIR), cache_headers=False),
                # Compatibility aliases for browser caches / manually registered
                # resources from Lotus Visual releases prior to 0.12.0.
                StaticPathConfig(LEGACY_URL_BASE, str(_FRONTEND_DIR), cache_headers=False),
                StaticPathConfig(LEGACY_BRAND_URL, str(_BRAND_DIR), cache_headers=False),
            ]
"""
    new_static = """            [
                # The package version is part of the URL. All relative ES-module
                # imports therefore share one immutable cache namespace.
                StaticPathConfig(versioned_url_base, str(_FRONTEND_DIR), cache_headers=True),
                StaticPathConfig(versioned_brand_url, str(_BRAND_DIR), cache_headers=True),
                # Keep unversioned and legacy aliases for existing manual resources.
                StaticPathConfig(URL_BASE, str(_FRONTEND_DIR), cache_headers=False),
                StaticPathConfig(BRAND_URL, str(_BRAND_DIR), cache_headers=False),
                StaticPathConfig(LEGACY_URL_BASE, str(_FRONTEND_DIR), cache_headers=False),
                StaticPathConfig(LEGACY_BRAND_URL, str(_BRAND_DIR), cache_headers=False),
            ]
"""
    if old_static not in text:
        raise RuntimeError("Static path block not found in __init__.py")
    text = text.replace(old_static, new_static)

    text = text.replace(
        "frontend.add_extra_js_url(hass, MODULE_URL)",
        "frontend.add_extra_js_url(hass, module_url)",
    )
    text = text.replace('"module_url": MODULE_URL,', '"module_url": module_url,')
    text = text.replace(
        'data[entry.entry_id] = {"module_url": MODULE_URL}',
        'data[entry.entry_id] = {"module_url": module_url}',
    )

    old_unload = """    try:
        frontend.remove_extra_js_url(hass, MODULE_URL)
    except (KeyError, ValueError):
        pass
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
"""
    new_unload = """    entry_data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    module_url = entry_data.get("module_url")
    if module_url:
        try:
            frontend.remove_extra_js_url(hass, module_url)
        except (KeyError, ValueError):
            pass
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
"""
    if old_unload not in text:
        raise RuntimeError("Unload block not found in __init__.py")
    text = text.replace(old_unload, new_unload)

    path.write_text(text, encoding="utf-8")


def create_runtime_version_module() -> None:
    path = FRONTEND / "lotus-version.js"
    path.write_text(
        '''/* Package version derived from the versioned static URL registered by Home Assistant. */
const moduleUrl = new URL(import.meta.url);
const pathParts = moduleUrl.pathname.split("/").filter(Boolean);
const pathVersion = decodeURIComponent(pathParts.at(-2) || "");
const queryVersion = String(moduleUrl.searchParams.get("v") || "").trim();
const candidate = queryVersion || pathVersion;
const VERSION_PATTERN = /^\\d+\\.\\d+\\.\\d+[0-9A-Za-z.+-]*$/;

export const LOTUS_PACKAGE_VERSION = VERSION_PATTERN.test(candidate) ? candidate : "dev";
export const LOTUS_PACKAGE_IS_VERSIONED = LOTUS_PACKAGE_VERSION !== "dev";
''',
        encoding="utf-8",
    )


def rename_beta_modules() -> None:
    renames = {
        "lotus-slide-editor-b1.js": "lotus-slide-editor.js",
        "lotus-slide-editor-direct-b1.js": "lotus-slide-editor-direct.js",
        "lotus-slide-editor-direct-fix-b1.js": "lotus-slide-editor-direct-fix.js",
    }
    for old_name, new_name in renames.items():
        old = FRONTEND / old_name
        new = FRONTEND / new_name
        if old.exists():
            old.rename(new)
        elif not new.exists():
            raise RuntimeError(f"Expected module missing: {old_name}")

    for path in FRONTEND.glob("*.js"):
        text = path.read_text(encoding="utf-8")
        for old_name, new_name in renames.items():
            text = text.replace(old_name, new_name)
        path.write_text(text, encoding="utf-8")


def remove_manual_cache_versions() -> None:
    for path in FRONTEND.glob("*.js"):
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"\?v=0\.13\.0b3", "", text)
        text = re.sub(r"\?v=\$\{[A-Z0-9_]+\}", "", text)
        path.write_text(text, encoding="utf-8")


def centralize_frontend_version() -> None:
    version_import = 'import { LOTUS_PACKAGE_VERSION } from "./lotus-version.js";\n'

    for filename in (
        "lotus-core.js",
        "lotus-i18n.js",
        "lotus-i18n-extra.js",
        "lotus-i18n-europe.js",
        "lotus-iconset.js",
        "lotus-direct-create-bridge.js",
        "lotus-edit-dialog-bridge.js",
        "lotus-icon-size-bridge.js",
        "lotus-image-fit-bridge.js",
    ):
        prepend_once(FRONTEND / filename, version_import)

    replacements: dict[str, tuple[tuple[str, str], ...]] = {
        "lotus-core.js": (
            ('export const LOTUS_VISUAL_VERSION = "0.13.0b3";',
             "export const LOTUS_VISUAL_VERSION = LOTUS_PACKAGE_VERSION;"),
        ),
        "lotus-i18n.js": (
            ('export const LOTUS_I18N_VERSION = "0.13.0b3";',
             "export const LOTUS_I18N_VERSION = LOTUS_PACKAGE_VERSION;"),
        ),
        "lotus-i18n-extra.js": (
            ('export const LOTUS_I18N_EXTRA_VERSION = "0.13.0b3";',
             "export const LOTUS_I18N_EXTRA_VERSION = LOTUS_PACKAGE_VERSION;"),
        ),
        "lotus-i18n-europe.js": (
            ('export const LOTUS_EUROPE_VERSION = "0.13.0b3";',
             "export const LOTUS_EUROPE_VERSION = LOTUS_PACKAGE_VERSION;"),
        ),
        "lotus-iconset.js": (
            ('const LOTUS_ICONSET_VERSION = "0.13.0b3";',
             "const LOTUS_ICONSET_VERSION = LOTUS_PACKAGE_VERSION;"),
        ),
        "lotus-direct-create-bridge.js": (
            ('directCreateBridge: "0.13.0b3"',
             "directCreateBridge: LOTUS_PACKAGE_VERSION"),
        ),
        "lotus-edit-dialog-bridge.js": (
            ('editDialogBridge: "0.13.0b3"',
             "editDialogBridge: LOTUS_PACKAGE_VERSION"),
        ),
        "lotus-icon-size-bridge.js": (
            ('iconSizeBridge: "0.13.0b3"',
             "iconSizeBridge: LOTUS_PACKAGE_VERSION"),
            ('stackResponsiveBridge: "0.13.0b3"',
             "stackResponsiveBridge: LOTUS_PACKAGE_VERSION"),
        ),
        "lotus-image-fit-bridge.js": (
            ('imageFitBridge: "0.13.0b3"',
             "imageFitBridge: LOTUS_PACKAGE_VERSION"),
        ),
    }

    for filename, pairs in replacements.items():
        path = FRONTEND / filename
        text = path.read_text(encoding="utf-8")
        for old, new in pairs:
            if old not in text:
                raise RuntimeError(f"Expected version value not found in {filename}: {old}")
            text = text.replace(old, new)
        path.write_text(text, encoding="utf-8")

    # Version mentions in comments are documentation, not runtime state.
    for path in FRONTEND.glob("*.js"):
        text = path.read_text(encoding="utf-8")
        text = text.replace("0.13.0b3", "current package")
        path.write_text(text, encoding="utf-8")


def simplify_bootstrap() -> None:
    path = FRONTEND / "lotus-visual.js"
    text = path.read_text(encoding="utf-8")

    old_header = """// Bootstrap version is intentionally local: the first import must itself be
// cache-busted. A static import of lotus-core.js could otherwise survive an
// integration upgrade in the browser ESM module map.
const LOTUS_VISUAL_BOOTSTRAP_VERSION = "current package";
"""
    if old_header not in text:
        raise RuntimeError("Old bootstrap version block not found in lotus-visual.js")
    text = text.replace(old_header, "")

    text = re.sub(
        r"await import\(`(\./[^`]+)`\);",
        lambda match: f'await import("{match.group(1)}");',
        text,
    )
    text = re.sub(
        r"await import\(`(\./[^`]+)`\)",
        lambda match: f'await import("{match.group(1)}")',
        text,
    )
    text = text.replace(
        "// current package keeps the stable 1.3.0 runtime and the editor UX refinements\n"
        "// introduced during the 0.13.0 beta cycle.\n",
        "// Load the stable Lotus Slide runtime and its visual editor refinements.\n",
    )
    path.write_text(text, encoding="utf-8")


def version_brand_asset() -> None:
    path = FRONTEND / "lotus-visual-manager.js"
    old = 'const LOTUS_BRAND_ICON_URL = `/lotus_view_studio_brand/icon.png?v=${LOTUS_VISUAL_VERSION}`;'
    new = (
        'const LOTUS_BRAND_ICON_URL = LOTUS_VISUAL_VERSION === "dev"\n'
        '  ? "/lotus_view_studio_brand/icon.png"\n'
        '  : `/lotus_view_studio_brand/${encodeURIComponent(LOTUS_VISUAL_VERSION)}/icon.png`;'
    )
    replace_required(path, old, new)


def validate() -> None:
    errors: list[str] = []

    manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != PACKAGE_VERSION:
        errors.append("manifest.json version was not updated")

    const_text = (COMPONENT / "const.py").read_text(encoding="utf-8")
    if re.search(r"^VERSION\s*=", const_text, flags=re.MULTILINE):
        errors.append("const.py still duplicates VERSION")
    if re.search(r"^MODULE_URL\s*=", const_text, flags=re.MULTILINE):
        errors.append("const.py still duplicates MODULE_URL")

    for path in sorted(FRONTEND.glob("*.js")):
        text = path.read_text(encoding="utf-8")
        if PACKAGE_VERSION in text:
            errors.append(f"{path.name}: package version is still hardcoded")
        if re.search(r"[?&]v=(?:\d|\$\{)", text):
            errors.append(f"{path.name}: manual version query-string remains")
        if re.search(r"-b\d+\.js$", path.name):
            errors.append(f"{path.name}: beta suffix remains in filename")

    if not (FRONTEND / "lotus-version.js").exists():
        errors.append("lotus-version.js was not created")

    if errors:
        raise RuntimeError("Version refactor validation failed:\n- " + "\n- ".join(errors))


def main() -> None:
    update_manifest()
    update_const()
    update_backend()
    create_runtime_version_module()
    rename_beta_modules()
    remove_manual_cache_versions()
    centralize_frontend_version()
    simplify_bootstrap()
    version_brand_asset()
    validate()
    print("Lotus View Studio package version architecture refactored successfully.")


if __name__ == "__main__":
    main()
