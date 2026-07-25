import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeUrl,
  isBlockedHost,
  parseIpv4,
  isBlockedIpv4,
  isBlockedIpv6Address,
} from "../extension/src/shared/url-safety.js";

test("sanitizeUrl accepts https public domains", () => {
  assert.equal(sanitizeUrl("https://example.com/terms"), "https://example.com/terms");
  assert.equal(sanitizeUrl("http://example.com/terms"), "http://example.com/terms");
});

test("sanitizeUrl rejects non-http protocols", () => {
  assert.equal(sanitizeUrl("file:///etc/hosts"), null);
  assert.equal(sanitizeUrl("ftp://example.com/x"), null);
  assert.equal(sanitizeUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeUrl("data:text/html,<script/>"), null);
});

test("sanitizeUrl rejects loopback in every IPv4 notation", () => {
  assert.equal(sanitizeUrl("http://127.0.0.1/x"), null);
  assert.equal(sanitizeUrl("http://2130706433/x"), null);
  assert.equal(sanitizeUrl("http://0x7f000001/x"), null);
  assert.equal(sanitizeUrl("http://017700000001/x"), null);
  assert.equal(sanitizeUrl("http://127.1/x"), null);
  assert.equal(sanitizeUrl("http://127.0.1/x"), null);
});

test("sanitizeUrl rejects RFC1918 and CGNAT ranges", () => {
  assert.equal(sanitizeUrl("http://10.0.0.1/"), null);
  assert.equal(sanitizeUrl("http://172.16.0.1/"), null);
  assert.equal(sanitizeUrl("http://172.31.255.255/"), null);
  assert.equal(sanitizeUrl("http://192.168.1.1/"), null);
  assert.equal(sanitizeUrl("http://169.254.169.254/"), null);
  assert.equal(sanitizeUrl("http://100.64.0.1/"), null);
});

test("sanitizeUrl rejects multicast and 0.0.0.0/8", () => {
  assert.equal(sanitizeUrl("http://0.0.0.0/"), null);
  assert.equal(sanitizeUrl("http://224.0.0.1/"), null);
  assert.equal(sanitizeUrl("http://239.255.255.255/"), null);
  assert.equal(sanitizeUrl("http://240.0.0.1/"), null);
});

test("sanitizeUrl rejects IPv6 loopback and link-local literals", () => {
  assert.equal(sanitizeUrl("http://[::1]/"), null);
  assert.equal(sanitizeUrl("http://[fe80::1]/"), null);
  assert.equal(sanitizeUrl("http://[fc00::1]/"), null);
});

test("sanitizeUrl rejects IPv4-mapped IPv6 pointing at private space", () => {
  assert.equal(sanitizeUrl("http://[::ffff:127.0.0.1]/"), null);
  assert.equal(sanitizeUrl("http://[::ffff:169.254.169.254]/"), null);
});

test("sanitizeUrl rejects cloud metadata endpoints and localhost variants", () => {
  assert.equal(sanitizeUrl("http://localhost/"), null);
  assert.equal(sanitizeUrl("http://foo.localhost/"), null);
  assert.equal(sanitizeUrl("http://metadata.google.internal/"), null);
  assert.equal(sanitizeUrl("http://metadata.aws.internal/"), null);
});

test("parseIpv4 handles decimal, hex, octal and short forms", () => {
  assert.equal(parseIpv4("127.0.0.1"), 0x7f000001);
  assert.equal(parseIpv4("2130706433"), 0x7f000001);
  assert.equal(parseIpv4("0x7f000001"), 0x7f000001);
  assert.equal(parseIpv4("017700000001"), 0x7f000001);
  assert.equal(parseIpv4("127.1"), 0x7f000001);
  assert.equal(parseIpv4("127.0.1"), 0x7f000001);
});

test("parseIpv4 rejects garbage", () => {
  assert.equal(parseIpv4("example.com"), null);
  assert.equal(parseIpv4("127.0.0.256"), null);
  assert.equal(parseIpv4("1.2.3.4.5"), null);
  assert.equal(parseIpv4(""), null);
});

test("isBlockedIpv4 boundary cases", () => {
  assert.equal(isBlockedIpv4(parseIpv4("172.15.0.0")), false);
  assert.equal(isBlockedIpv4(parseIpv4("172.16.0.0")), true);
  assert.equal(isBlockedIpv4(parseIpv4("172.31.255.255")), true);
  assert.equal(isBlockedIpv4(parseIpv4("172.32.0.0")), false);
  assert.equal(isBlockedIpv4(parseIpv4("8.8.8.8")), false);
});

test("isBlockedIpv6Address treats loopback and unspecified as blocked", () => {
  assert.equal(isBlockedIpv6Address(1n), true);
  assert.equal(isBlockedIpv6Address(0n), true);
});

test("isBlockedHost accepts a public hostname", () => {
  assert.equal(isBlockedHost("example.com"), false);
  assert.equal(isBlockedHost("8.8.8.8"), false);
});
