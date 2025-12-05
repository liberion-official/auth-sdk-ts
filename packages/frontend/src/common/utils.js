import { DEBUG, THEME_MODES } from "./constants";

export const log = (...args) => {
  DEBUG && typeof console !== "undefined" && console.log(...args);
  return false;
};

export const logError = (...args) => {
  DEBUG && typeof console !== "undefined" && console.error(...args);
  return false;
};

export const logWarn = (...args) => {
  DEBUG && typeof console !== "undefined" && console.warn(...args);
  return false;
};

export const isAndroid = () => {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
};

export const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || window?.opera || "";

  const iDeviceMatch = /iPhone|iPad|iPod/i.test(ua);

  const iPadOsMatch =
    !iDeviceMatch &&
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1;

  return iDeviceMatch || iPadOsMatch;
};

export const isMobile = () => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isAndroid || isiOS;
};

export const decodeUrlParam = (encodedUrl) => {
  if (!encodedUrl) return "";
  try {
    return decodeURIComponent(encodedUrl);
  } catch (error) {
    logError("[decodeUrlParam] Failed to decode URL:", error?.message);
    return encodedUrl;
  }
};

export const getSystemTheme = () => {
  if (typeof window === "undefined") return THEME_MODES.DARK;

  const isDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return isDarkMode ? THEME_MODES.DARK : THEME_MODES.LIGHT;
};

export const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  try {
    const urlObj = new URL(url);
    // Allow only http and https protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return false;
    }
    return true;
  } catch (error) {
    logError("[isValidUrl] Invalid URL:", error?.message);
    return false;
  }
};
