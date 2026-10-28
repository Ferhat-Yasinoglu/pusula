/**
 * The patch bay's code samples (spec §6.7): the snippet builder moved here
 * from the old `components/Tools.tsx` (one fix, below), plus a tiny tokenizer that
 * colours each line for the `Terminal` (keywords gold, strings foam, the base
 * URL gold-hi, and `"auto"` ember: the one token the station is about).
 *
 * Pure: no React, no DOM. Pinned by `tests/unit/landing-tools.test.ts`.
 */

export type SnippetLang = "curl" | "javascript" | "python";

export const SNIPPET_LANGS: readonly { id: SnippetLang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export function isSnippetLang(value: string): value is SnippetLang {
  return value === "curl" || value === "javascript" || value === "python";
}

/**
 * The example request for one language, against `{baseUrl}/v1`: the old
 * Tools.tsx builder, with one fix: the Python sample now imports `os`, which
 * it reads the key from (copied as it was, it raised a NameError).
 */
export function snippet(lang: SnippetLang, baseUrl: string): string {
  const url = `${baseUrl}/v1`;
  switch (lang) {
    case "curl":
      return [
        `curl ${url}/chat/completions \\`,
        `  -H "Authorization: Bearer $PUSULA_API_KEY" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`,
      ].join("\n");
    case "javascript":
      return [
        `import OpenAI from "openai";`,
        ``,
        `const client = new OpenAI({`,
        `  baseURL: "${url}",`,
        `  apiKey: process.env.PUSULA_API_KEY,`,
        `});`,
        ``,
        `const reply = await client.chat.completions.create({`,
        `  model: "auto",`,
        `  messages: [{ role: "user", content: "Hello" }],`,
        `});`,
      ].join("\n");
    case "python":
      return [
        `import os`,
        `from openai import OpenAI`,
        ``,
        `client = OpenAI(base_url="${url}", api_key=os.environ["PUSULA_API_KEY"])`,
        ``,
        `reply = client.chat.completions.create(`,
        `    model="auto",`,
        `    messages=[{"role": "user", "content": "Hello"}],`,
        `)`,
      ].join("\n");
  }
}

/* ------------------------------------------------------------------------ */
/* Tokens                                                                   */
/* ------------------------------------------------------------------------ */

/** Same shape as the primitives' `TypeToken` (kept local so this module stays React-free). */
export type SnippetTokenClass = "kw" | "str" | "num" | "accent";
export type SnippetToken = { t: string; c?: SnippetTokenClass };
export type SnippetLine = { text: string; tokens: readonly SnippetToken[] };

/** The ember token: the model id that hands the choice to Pusula. */
export const AUTO_LITERAL = '"auto"';

const KEYWORDS = new Set(["curl", "import", "from", "const", "await", "new"]);

/**
 * Strings (double or single quoted), command-line flags (` -H`), and words.
 * Everything between matches stays plain.
 */
const LEXEME =
  /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(?<=^|\s)(-[A-Za-z])(?=\s|$)|([A-Za-z_]\w*)/g;

function push(out: SnippetToken[], t: string, c?: SnippetTokenClass): void {
  if (t.length === 0) return;
  const last = out[out.length - 1];
  // Merge neighbours of the same colour: fewer spans to type into.
  if (last && last.c === c) {
    last.t += t;
    return;
  }
  out.push(c ? { t, c } : { t });
}

/** Split `text` around every `needle`, giving the needle class `hit` and the rest class `rest`. */
function splitAround(
  out: SnippetToken[],
  text: string,
  needle: string,
  hit: SnippetTokenClass,
  rest: SnippetTokenClass | undefined
): void {
  if (!needle) {
    push(out, text, rest);
    return;
  }
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    push(out, text.slice(from, at), rest);
    push(out, needle, hit);
    from = at + needle.length;
  }
  push(out, text.slice(from), rest);
}

/** Plain text, with the base URL lifted out in gold-hi. */
function pushPlain(out: SnippetToken[], text: string, url: string): void {
  splitAround(out, text, url, "num", undefined);
}

/** A string literal: `"auto"` in ember, the base URL in gold-hi, the rest foam. */
function pushString(out: SnippetToken[], text: string, url: string): void {
  const parts: SnippetToken[] = [];
  splitAround(parts, text, AUTO_LITERAL, "accent", "str");
  for (const part of parts) {
    if (part.c === "str") splitAround(out, part.t, url, "num", "str");
    else push(out, part.t, part.c);
  }
}

/** Colour one line of a snippet. The tokens always join back to `line` exactly. */
export function tokenizeLine(line: string, url: string): SnippetToken[] {
  const out: SnippetToken[] = [];
  let last = 0;
  LEXEME.lastIndex = 0;
  for (let match = LEXEME.exec(line); match; match = LEXEME.exec(line)) {
    const [whole, quoted, flag, word] = match;
    if (word !== undefined && !KEYWORDS.has(word)) continue; // stays in the plain run
    pushPlain(out, line.slice(last, match.index), url);
    if (quoted !== undefined) pushString(out, quoted, url);
    else if (flag !== undefined) push(out, flag, "kw");
    else push(out, whole, "kw");
    last = match.index + whole.length;
  }
  pushPlain(out, line.slice(last), url);
  return out;
}

/** The snippet as coloured lines, ready for `Terminal`. */
export function snippetLines(lang: SnippetLang, baseUrl: string): SnippetLine[] {
  const url = `${baseUrl}/v1`;
  return snippet(lang, baseUrl)
    .split("\n")
    .map((text) => ({ text, tokens: tokenizeLine(text, url) }));
}

/* ------------------------------------------------------------------------ */
/* The comment line                                                         */
/* ------------------------------------------------------------------------ */

/** Line-comment marker of each language (the comment must stay valid code). */
export function commentPrefix(lang: SnippetLang): string {
  return lang === "javascript" ? "// " : "# ";
}

/** Unicode right-to-left isolate: keeps a Persian sentence whole inside the LTR code block. */
const RLI = "⁧";
const PDI = "⁩";

/**
 * The comment line on top of the snippet: the base-URL caption, or the
 * hovered tool's "point its base URL here" sentence. In an RTL locale
 * the translated sentence is wrapped in an RTL isolate, so its words keep
 * their order inside the left-to-right `<pre>`.
 */
export function commentLine(lang: SnippetLang, sentence: string, rtl: boolean): SnippetLine {
  const prefix = commentPrefix(lang);
  const body = rtl ? `${RLI}${sentence}${PDI}` : sentence;
  return { text: `${prefix}${body}`, tokens: [{ t: prefix, c: "kw" }, { t: body }] };
}
