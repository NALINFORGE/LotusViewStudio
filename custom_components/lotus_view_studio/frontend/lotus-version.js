/* Package version derived from the versioned static URL registered by Home Assistant. */
const moduleUrl = new URL(import.meta.url);
const pathParts = moduleUrl.pathname.split("/").filter(Boolean);
const candidate = decodeURIComponent(pathParts.at(-2) || "");
const VERSION_PATTERN = /^\d+\.\d+\.\d+[0-9A-Za-z.+-]*$/;

export const LOTUS_PACKAGE_VERSION = VERSION_PATTERN.test(candidate) ? candidate : "dev";
export const LOTUS_PACKAGE_IS_VERSIONED = LOTUS_PACKAGE_VERSION !== "dev";
