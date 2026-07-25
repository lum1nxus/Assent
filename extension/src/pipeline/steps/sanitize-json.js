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
    try {
      return JSON.parse(sanitizeJson(trimmed));
    } catch {
      return JSON.parse(repairTruncatedJson(sanitizeJson(trimmed)));
    }
  }
}

export function repairTruncatedJson(raw) {
  let inStr = false;
  let escape = false;
  const stack = [];
  let lastCleanBoundary = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      lastCleanBoundary = i + 1;
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      lastCleanBoundary = i + 1;
      continue;
    }
    if (ch === ",") {
      lastCleanBoundary = i + 1;
    }
  }

  if (!inStr && stack.length === 0) {
    return raw;
  }

  let truncated = raw.slice(0, lastCleanBoundary).trimEnd();
  truncated = truncated.replace(/,\s*$/, "");

  const opened = [];
  let s = false;
  let e = false;
  for (let i = 0; i < truncated.length; i += 1) {
    const ch = truncated[i];
    if (e) {
      e = false;
      continue;
    }
    if (s) {
      if (ch === "\\") {
        e = true;
        continue;
      }
      if (ch === '"') {
        s = false;
      }
      continue;
    }
    if (ch === '"') {
      s = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      opened.push(ch);
    } else if (ch === "}" || ch === "]") {
      opened.pop();
    }
  }

  for (let i = opened.length - 1; i >= 0; i -= 1) {
    truncated += opened[i] === "{" ? "}" : "]";
  }
  return truncated;
}
