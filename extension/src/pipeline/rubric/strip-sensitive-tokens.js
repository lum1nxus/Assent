const TLD_STRIP =
  /\.(?:com|net|org|io|co|app|dev|de|fr|it|es|nl|uk|us|eu|se|no|fi|dk|jp|ru|cn|au|ca|br|in|info|biz|ai|cloud|store)$/i;
const MIN_TOKEN_LENGTH = 4;

export function extractDomainTokens(domain) {
  if (typeof domain !== "string" || domain.length === 0) {
    return [];
  }
  const host = domain
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^[a-z]+:\/\//, "");
  const parts = host.split(".").filter(Boolean);
  const tokens = new Set();
  for (const part of parts) {
    if (part.length >= MIN_TOKEN_LENGTH && !TLD_STRIP.test(`.${part}`)) {
      tokens.add(part);
    }
  }
  if (parts.length >= 2) {
    const label = parts[parts.length - 2];
    if (label.length >= MIN_TOKEN_LENGTH) {
      tokens.add(label);
    }
  }
  return Array.from(tokens);
}

export function stripSensitiveTokens(str, domain) {
  if (typeof str !== "string" || str.length === 0) {
    return str;
  }
  const tokens = extractDomainTokens(domain);
  if (tokens.length === 0) {
    return str;
  }
  let out = str;
  for (const tok of tokens) {
    const re = new RegExp(`\\b${escapeRegex(tok)}(?:'s|s)?\\b`, "gi");
    out = out.replace(re, "the service");
  }
  return collapseSpaces(out);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseSpaces(s) {
  return s.replace(/\s{2,}/g, " ").trim();
}
