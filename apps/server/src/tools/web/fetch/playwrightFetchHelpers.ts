import { runTerminalInSession } from "../../sandbox.tool.js";

const N_4096 = 4096;
const N_500 = 500;
const N_64 = 64;

export const MAX_TEXT = 40000;

export function stripToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function shSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const PLAYWRIGHT_FETCH_SCRIPT = `(async()=>{const{chromium}=require('playwright');const url=process.argv[1];const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});const text=await page.evaluate(()=>document.body?document.body.innerText:'');process.stdout.write(JSON.stringify({text,finalUrl:page.url()}));}finally{await browser.close();}})().catch((e)=>{console.error(String(e));process.exit(1);});`;

export async function fetchWithPlaywright(options: {
  sessionId: string;
  url: string;
}): Promise<{
  success: boolean;
  output: string;
  metadata: Record<string, unknown>;
}> {
  const { sessionId, url } = options;
  const command = `node -e ${shSingleQuote(PLAYWRIGHT_FETCH_SCRIPT)} ${shSingleQuote(url)}`;
  const r = await runTerminalInSession({
    sessionId,
    command,
    maxOutputChars: MAX_TEXT + N_4096
  });
  if (!r.success) {
    return {
      success: false,
      output: `web_fetch failed: playwright error: ${r.output.slice(0, N_500)}`,
      metadata: { url, code: "timeout", engine: "playwright", sessionId }
    };
  }
  try {
    const parsed = JSON.parse(r.output.trim()) as {
      text?: string;
      finalUrl?: string;
    };
    let text = (parsed.text || "").trim();
    const truncated = text.length > MAX_TEXT;
    if (truncated) text = text.slice(0, MAX_TEXT);
    if (!text) {
      return {
        success: false,
        output: "web_fetch failed: no extractable content",
        metadata: { url, code: "empty", engine: "playwright", sessionId }
      };
    }
    return {
      success: true,
      output: text,
      metadata: {
        url,
        finalUrl: parsed.finalUrl || url,
        truncated,
        engine: "playwright",
        sessionId
      }
    };
  } catch {
    return {
      success: false,
      output: "web_fetch failed: invalid playwright payload",
      metadata: { url, code: "parse", engine: "playwright", sessionId }
    };
  }
}

export async function fetchWithCurlFallback(options: {
  sessionId: string;
  url: string;
}): Promise<{
  success: boolean;
  output: string;
  metadata: Record<string, unknown>;
}> {
  const { sessionId, url } = options;
  const curlCommand = `wget -qO- --timeout=15 ${shSingleQuote(url)} 2>/dev/null || curl -fsSL --max-time 15 ${shSingleQuote(url)}`;
  const curl = await runTerminalInSession({
    sessionId,
    command: curlCommand,
    maxOutputChars: MAX_TEXT + N_4096
  });
  if (!curl.success || !curl.output.trim()) {
    return {
      success: false,
      output:
        "web_fetch failed: Playwright is not available, and curl/wget fetch also failed. In host mode install Playwright browsers (e.g. `npx playwright install`) or ensure curl/wget is on PATH.",
      metadata: { url, code: "empty", engine: "none", sessionId }
    };
  }
  let text = stripToText(curl.output);
  const truncated = text.length > MAX_TEXT;
  if (truncated) text = text.slice(0, MAX_TEXT);
  return {
    success: true,
    output: text || "(empty page text)",
    metadata: {
      url,
      finalUrl: url,
      truncated,
      engine: "curl-html",
      sessionId,
      note: "Playwright not found; used curl/wget fallback"
    }
  };
}

export async function playwrightAvailable(sessionId: string): Promise<boolean> {
  const pwCheck = await runTerminalInSession({
    sessionId,
    command: `node -e "try{require('playwright');console.log('ok')}catch(e){process.exit(1)}" 2>/dev/null`,
    maxOutputChars: N_64
  });
  return Boolean(pwCheck.success && pwCheck.output.includes("ok"));
}
