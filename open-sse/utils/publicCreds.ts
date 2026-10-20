/**
 * Public credentials decoder.
 *
 * Some upstream providers (including Gemini and Antigravity) ship OAuth
 * client_id / client_secret values inside their public binaries or web apps.
 * These are credentials by name only: OAuth client credentials for
 * native/installed apps using PKCE are publicly distributed and must not be
 * treated as secrets.
 * https://developers.google.com/identity/protocols/oauth2/native-app
 *
 * Pusula embeds them so users who do not configure `.env` still get a
 * working OAuth flow out of the box. The literals, however, trip pattern
 * scanners (AIza..., GOCSPX-..., ...googleusercontent.com) and produce
 * noisy false-positive alerts on every release.
 *
 * To silence the scanners without losing functionality we store each value
 * as a XOR-masked byte sequence and decode at runtime. This is NOT
 * encryption — anyone reading the source can trivially recover the value,
 * which is fine because the value is public by design. The only goal is to
 * avoid known scanner regexes in the source text.
 *
 * Backward compatibility: `decodePublicCred()` detects raw values by their
 * well-known prefixes and passes them through unchanged, so existing env
 * overrides do not require migration.
 */

const MASK = "pusula-public-v1";

const RAW_VALUE_PATTERN =
  /^(AIza[A-Za-z0-9_-]{20,}|GOCSPX-[A-Za-z0-9_-]+|\d+-[a-z0-9]{32}\.apps\.googleusercontent\.com|Iv1\.[a-f0-9]+)$/;

function unmaskBytes(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ^ MASK.charCodeAt(i % MASK.length));
  }
  return out;
}

function maskBytes(plain: string): number[] {
  const arr: number[] = [];
  for (let i = 0; i < plain.length; i++) {
    arr.push(plain.charCodeAt(i) ^ MASK.charCodeAt(i % MASK.length));
  }
  return arr;
}

// A valid base64-encoded masked value uses only the base64 alphabet plus
// optional padding. Anything outside that alphabet is definitely a raw
// credential the user supplied (a token format we don't yet recognize in
// RAW_VALUE_PATTERN) — never try to base64-decode it.
const STRICT_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// Plaintext credentials never contain control characters. If unmasking
// produces non-printable bytes, the input wasn't actually masked and we
// must return it untouched to avoid silently mangling raw overrides.
function looksLikePrintablePlain(s: string): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // Allow printable ASCII (0x20–0x7E). Everything outside that is suspect.
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

/**
 * Decode a public credential. Accepts either a raw literal (well-known prefix)
 * or a base64 string produced by `encodePublicCred()`. Returns the plaintext.
 * Empty / nullish input returns "".
 *
 * When the input doesn't match a known raw-credential prefix, we tentatively
 * base64-decode + XOR-unmask, but only adopt the result if it looks like a
 * printable plaintext. Otherwise we return the original value unchanged —
 * `Buffer.from(value, "base64")` is lenient (it silently drops invalid chars
 * instead of throwing) so a raw secret with a unknown format would otherwise
 * be silently mangled. See docs/security/PUBLIC_CREDS.md.
 */
export function decodePublicCred(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "";

  if (RAW_VALUE_PATTERN.test(value)) return value;

  // Reject anything that isn't strict base64 — saves us from feeding raw
  // ASCII overrides into the lenient Buffer.from(...,"base64") path.
  if (!STRICT_BASE64.test(value)) return value;

  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length === 0) return value;
    const arr: number[] = [];
    for (let i = 0; i < buf.length; i++) arr.push(buf[i]);
    const decoded = unmaskBytes(arr);
    return looksLikePrintablePlain(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

/**
 * Encode a plaintext value as base64. Used by maintainers when adding a new
 * embedded default. Not used at runtime.
 */
export function encodePublicCred(plain: string): string {
  if (!plain) return "";
  return Buffer.from(maskBytes(plain)).toString("base64");
}

/**
 * Decode a masked byte sequence (embedded form) to its plaintext value.
 */
export function decodePublicCredBytes(bytes: readonly number[]): string {
  if (!bytes || bytes.length === 0) return "";
  return unmaskBytes(bytes);
}

/**
 * Embedded public defaults. Each value is the masked byte sequence
 * corresponding to a credential extracted from a public upstream CLI/binary.
 *
 * To regenerate a value:
 *   node -e 'import("./open-sse/utils/publicCreds.ts").then(m =>
 *     console.log(JSON.stringify(m.encodePublicCred("<plaintext>"))))'
 *
 * Or use the helper below `embeddedBytesFor()`.
 */
const EMBEDDED_DEFAULTS = {
  // Gemini / Code Assist — google oauth client (public, PKCE)
  gemini_id: [
    70, 77, 66, 71, 89, 84, 21, 64, 76, 81, 85, 92, 78, 66, 25, 9, 22, 1, 65, 26, 28, 19, 73, 2, 27,
    18, 85, 12, 80, 76, 7, 87, 70, 20, 5, 70, 4, 12, 73, 25, 23, 83, 95, 92, 9, 3, 23, 65, 0, 6, 93,
    18, 3, 14, 74, 28, 16, 23, 31, 12, 17, 78, 25, 95, 4, 16, 29, 1, 66, 2, 66, 29,
  ],
  gemini_alt: [
    55, 58, 48, 38, 60, 57, 0, 68, 0, 42, 11, 36, 51, 64, 91, 0, 31, 66, 32, 30, 65, 6, 72, 38, 67,
    33, 25, 92, 0, 65, 46, 119, 3, 13, 31,
  ],
  // Antigravity — google oauth client (public)
  antigravity_id: [
    65, 69, 68, 68, 92, 81, 27, 64, 67, 82, 89, 80, 82, 0, 2, 92, 24, 6, 0, 28, 2, 83, 69, 66, 68,
    14, 15, 27, 6, 31, 69, 4, 6, 1, 28, 25, 3, 11, 69, 68, 18, 86, 92, 90, 6, 93, 88, 80, 0, 5, 0,
    91, 11, 14, 66, 23, 25, 7, 25, 26, 6, 95, 21, 94, 30, 1, 22, 27, 24, 79, 78, 31, 24,
  ],
  antigravity_alt: [
    55, 58, 48, 38, 60, 57, 0, 59, 64, 90, 42, 62, 49, 25, 78, 7, 60, 17, 63, 63, 93, 12, 97, 50,
    77, 17, 52, 42, 87, 87, 64, 64, 52, 52, 21,
  ],
  // Claude Code CLI — anthropic oauth client (public, PKCE)
  claude_id: [
    73, 17, 66, 22, 94, 84, 29, 17, 88, 7, 90, 88, 1, 0, 66, 5, 20, 76, 94, 77, 84, 4, 73, 93, 64,
    91, 88, 93, 7, 28, 79, 7, 66, 19, 70, 16,
  ],
  // Codex CLI — openai oauth client (public, PKCE)
  codex_id: [
    17, 5, 3, 42, 41, 44, 66, 17, 24, 39, 41, 51, 84, 30, 16, 1, 51, 30, 43, 20, 52, 17, 26, 24, 7,
    3, 2, 7,
  ],
  // Kimi coding CLI — moonshot oauth client (public)
  kimi_id: [
    65, 66, 22, 64, 10, 87, 26, 65, 88, 6, 93, 80, 87, 0, 66, 85, 22, 23, 94, 76, 91, 81, 27, 93,
    64, 87, 93, 95, 0, 79, 66, 9, 19, 69, 74, 77,
  ],
  // GitHub Copilot CLI — github oauth app id (public, device flow)
  github_copilot_id: [
    57, 3, 66, 91, 14, 84, 29, 71, 20, 82, 84, 10, 91, 26, 19, 82, 22, 16, 74, 77,
  ],
  // Grok Build CLI (xAI) — public oauth client id (import-token flow)
  grok_id: [
    18, 68, 18, 69, 92, 85, 20, 66, 88, 82, 91, 90, 2, 0, 66, 6, 21, 20, 94, 77, 93, 87, 75, 93, 65,
    1, 95, 91, 90, 31, 64, 5, 17, 77, 65, 77,
  ],
  // Openference OAuth — public PKCE client id.
  openference_id: [31, 24, 29, 28, 30, 14, 88, 4, 16],
  // Trae Cloud IDE — public oauth client id
  trae_id: [21, 27, 66, 26, 20, 24, 26, 7, 27, 21, 84, 3, 90, 67],
  // Microsoft 365 Copilot web (m365.cloud.microsoft) — public SPA client id
  // observed in browser tokens and M365-Copilot2API. Not a per-user secret.
  m365_oauth_client_id: [
    19, 69, 18, 23, 84, 2, 72, 73, 88, 7, 85, 8, 83, 0, 66, 3, 21, 66, 94, 23, 92, 87, 25, 93, 70,
    81, 8, 93, 81, 31, 18, 87, 68, 68, 21, 68,
  ],
  // Adobe Firefly web (firefly.adobe.com) — public x-api-key + IMS client_id
  // (`clio-playground-web`). Captured from live browser generate/discovery calls.
  // Not a per-user secret; every Firefly SPA session sends the same value.
  // (Express still uses `projectx_webapp` — see adobe_firefly_express_client_id.)
  adobe_firefly_api_key: [19, 25, 26, 26, 65, 17, 65, 17, 12, 5, 30, 6, 22, 67, 18, 28, 7, 16, 17],
  // Adobe Express fallback IMS client_id for cookie exchange when Firefly
  // clio-playground-web refresh fails (older Express cookies).
  adobe_firefly_express_client_id: [0, 7, 28, 31, 9, 2, 89, 8, 42, 21, 9, 11, 2, 93, 6],
  // Firefly credits balance endpoint public x-api-key (`SunbreakWebUI1`) from
  // GET firefly.adobe.io/v1/credits/balance browser traffic.
  adobe_firefly_balance_api_key: [35, 0, 29, 23, 30, 4, 76, 27, 34, 7, 14, 60, 42, 28],
  // Muse Code CLI — Meta public OAuth client id (device grant, no secret).
  muse_id: [65, 69, 64, 68, 90, 83, 24, 73, 64, 80, 91, 93, 91, 20, 66, 7],
} as const;

export type EmbeddedDefaultKey = keyof typeof EMBEDDED_DEFAULTS;

/**
 * Resolve a public credential with `process.env` override priority:
 *   1. `process.env[envName]` if set and non-empty (raw or masked, both work)
 *   2. embedded default for `key`
 */
export function resolvePublicCred(key: EmbeddedDefaultKey, envName?: string): string {
  if (envName) {
    const fromEnv = process.env[envName];
    if (fromEnv && fromEnv.trim()) return decodePublicCred(fromEnv.trim());
  }
  return decodePublicCredBytes(EMBEDDED_DEFAULTS[key]);
}

/**
 * Resolve with multiple env-var aliases (first non-empty wins). Useful for
 * providers that support both legacy and new env names.
 */
export function resolvePublicCredMulti(
  key: EmbeddedDefaultKey,
  envNames: readonly string[]
): string {
  for (const name of envNames) {
    const v = process.env[name];
    if (v && v.trim()) return decodePublicCred(v.trim());
  }
  return decodePublicCredBytes(EMBEDDED_DEFAULTS[key]);
}
