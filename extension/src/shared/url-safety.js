const BLOCKED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.aws.internal",
  "metadata.azure.com",
]);

const IPV4_BLOCKED_RANGES = [
  { base: 0x00000000, mask: 0xff000000 },
  { base: 0x0a000000, mask: 0xff000000 },
  { base: 0x64400000, mask: 0xffc00000 },
  { base: 0x7f000000, mask: 0xff000000 },
  { base: 0xa9fe0000, mask: 0xffff0000 },
  { base: 0xac100000, mask: 0xfff00000 },
  { base: 0xc0a80000, mask: 0xffff0000 },
  { base: 0xe0000000, mask: 0xf0000000 },
  { base: 0xf0000000, mask: 0xf0000000 },
];

export function sanitizeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (isBlockedHost(host)) {
    return null;
  }

  return url.toString();
}

export function isBlockedHost(hostname) {
  if (!hostname) {
    return true;
  }
  let host = String(hostname).toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  if (BLOCKED_HOSTS.has(host)) {
    return true;
  }
  if (host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }

  if (host.includes(":")) {
    const ipv6 = expandIpv6(host);
    if (ipv6 !== null) {
      return isBlockedIpv6Address(ipv6);
    }
    return true;
  }

  const ipv4 = parseIpv4(host);
  if (ipv4 !== null) {
    return isBlockedIpv4(ipv4);
  }

  return false;
}

export function parseIpv4(host) {
  if (typeof host !== "string" || host.length === 0) {
    return null;
  }
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) {
    return null;
  }
  const nums = [];
  for (let i = 0; i < parts.length; i += 1) {
    const n = parseUnsignedNumber(parts[i]);
    if (n === null) {
      return null;
    }
    nums.push(n);
  }
  const last = nums[nums.length - 1];
  let result;
  switch (nums.length) {
    case 1:
      if (last > 0xffffffff) {
        return null;
      }
      result = last;
      break;
    case 2:
      if (nums[0] > 0xff || last > 0xffffff) {
        return null;
      }
      result = (nums[0] << 24) >>> 0;
      result = (result + last) >>> 0;
      break;
    case 3:
      if (nums[0] > 0xff || nums[1] > 0xff || last > 0xffff) {
        return null;
      }
      result = (((nums[0] << 24) >>> 0) + (nums[1] << 16) + last) >>> 0;
      break;
    case 4:
      if (nums.some((n) => n > 0xff)) {
        return null;
      }
      result = (((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3]) >>> 0;
      break;
    default:
      return null;
  }
  return result;
}

function parseUnsignedNumber(str) {
  if (!str || /\s/.test(str)) {
    return null;
  }
  let value;
  if (/^0x[0-9a-f]+$/i.test(str)) {
    value = parseInt(str.slice(2), 16);
  } else if (/^0[0-7]+$/.test(str)) {
    value = parseInt(str.slice(1), 8);
  } else if (/^[0-9]+$/.test(str)) {
    value = parseInt(str, 10);
  } else {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function isBlockedIpv4(intValue) {
  for (const { base, mask } of IPV4_BLOCKED_RANGES) {
    if ((intValue & mask) >>> 0 === base) {
      return true;
    }
  }
  return false;
}

function expandIpv6(host) {
  if (typeof host !== "string") {
    return null;
  }
  let s = host;

  const embeddedV4 = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (embeddedV4) {
    const v4 = parseIpv4(embeddedV4[2]);
    if (v4 === null) {
      return null;
    }
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = `${embeddedV4[1]}${hi}:${lo}`;
  }

  if (!/^[0-9a-f:]+$/i.test(s)) {
    return null;
  }

  const doubleColon = s.split("::");
  if (doubleColon.length > 2) {
    return null;
  }
  let head = [];
  let tail = [];
  if (doubleColon.length === 2) {
    head = doubleColon[0] ? doubleColon[0].split(":") : [];
    tail = doubleColon[1] ? doubleColon[1].split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      return null;
    }
    for (let i = 0; i < missing; i += 1) {
      head.push("0");
    }
  } else {
    head = s.split(":");
    if (head.length !== 8) {
      return null;
    }
  }
  const parts = [...head, ...tail];
  if (parts.length !== 8) {
    return null;
  }

  let acc = 0n;
  for (const p of parts) {
    if (p.length === 0 || p.length > 4) {
      return null;
    }
    const n = parseInt(p, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) {
      return null;
    }
    acc = (acc << 16n) | BigInt(n);
  }
  return acc;
}

export function isBlockedIpv6Address(bigintAddr) {
  if (typeof bigintAddr !== "bigint") {
    return true;
  }
  if (bigintAddr === 1n) {
    return true;
  }
  if (bigintAddr === 0n) {
    return true;
  }
  const top16 = Number(bigintAddr >> 112n) & 0xffff;
  if ((top16 & 0xfe00) === 0xfc00) {
    return true;
  }
  if ((top16 & 0xffc0) === 0xfe80) {
    return true;
  }
  const upper96 = bigintAddr >> 32n;
  if (upper96 === 0xffffn) {
    const v4 = Number(bigintAddr & 0xffffffffn);
    return isBlockedIpv4(v4);
  }
  return false;
}
