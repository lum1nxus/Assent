import { CATEGORIES } from "./categories.js";

export function resolveTitle(category) {
  const cat = CATEGORIES[category];
  if (!cat) {
    return prettify(category);
  }
  if (typeof chrome !== "undefined" && chrome.i18n) {
    const msg = chrome.i18n.getMessage(cat.msg);
    if (msg) {
      return msg;
    }
  }
  return prettify(category);
}

function prettify(id) {
  if (typeof id !== "string" || id.length === 0) {
    return "";
  }
  return id
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
