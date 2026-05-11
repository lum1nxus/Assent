const VALID_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);

export function sanitizeJson(raw) {
  let out = "";
  let inStr = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (!inStr) {
      if (ch === '"') {
        inStr = true;
      }
      out += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inStr = false;
      out += ch;
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = raw[i + 1] ?? "";
      if (VALID_ESCAPES.has(next)) {
        out += ch + next;
        i += 2;
        continue;
      }
      if (next === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += ch + next + hex;
          i += 6;
          continue;
        }
      }
      out += "\\\\";
      i++;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else if (ch === "\b") {
        out += "\\b";
      } else if (ch === "\f") {
        out += "\\f";
      } else {
        out += `\\u${code.toString(16).padStart(4, "0")}`;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function parseLooseJson(raw) {
  const trimmed = String(raw)
    .trim()
    .replace(/^```(?:json)?/, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(sanitizeJson(trimmed));
  }
}
