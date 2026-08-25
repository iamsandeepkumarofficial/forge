import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const N_6 = 6;

const BLOCKED_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^172\.(1[6-9]|2\d|3[01])\./
];
function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_V4.some((re) => re.test(ip));
}
function isBlockedIpv6(ip: string): boolean {
  const n = ip.toLowerCase();
  if (n === "::1" || n === "::") return true;
  if (n.startsWith("fc") || n.startsWith("fd")) return true;
  if (n.startsWith("fe80:")) return true;
  return false;
}
export function assertHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Object.assign(new Error("invalid URL"), { code: "ssrf" as const });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error(`unsupported scheme: ${u.protocol}`), {
      code: "ssrf" as const
    });
  }
  return u;
}
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const u = assertHttpUrl(raw);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host) {
    throw Object.assign(new Error("missing host"), { code: "ssrf" as const });
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw Object.assign(new Error("localhost blocked"), {
      code: "ssrf" as const
    });
  }
  const literal = isIP(host);
  if (literal === 4 && isBlockedIpv4(host)) {
    throw Object.assign(new Error("private IPv4 blocked"), {
      code: "ssrf" as const
    });
  }
  if (literal === N_6 && isBlockedIpv6(host)) {
    throw Object.assign(new Error("private IPv6 blocked"), {
      code: "ssrf" as const
    });
  }
  if (literal === 0) {
    let addrs: string[];
    try {
      const res = await lookup(host, { all: true });
      addrs = res.map((r) => r.address);
    } catch {
      throw Object.assign(new Error(`DNS lookup failed for ${host}`), {
        code: "ssrf" as const
      });
    }
    for (const addr of addrs) {
      const t = isIP(addr);
      if (t === 4 && isBlockedIpv4(addr)) {
        throw Object.assign(new Error("host resolves to private IPv4"), {
          code: "ssrf" as const
        });
      }
      if (t === N_6 && isBlockedIpv6(addr)) {
        throw Object.assign(new Error("host resolves to private IPv6"), {
          code: "ssrf" as const
        });
      }
    }
  }
  return u;
}
