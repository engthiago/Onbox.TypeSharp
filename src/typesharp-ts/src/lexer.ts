import type { CommentTrivia } from "./ast";

export type TokenKind =
  | "identifier"
  | "keyword"
  | "string"
  | "number"
  | "punctuation"
  | "eof";

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
  leadingComments: CommentTrivia[];
  trailingComments: CommentTrivia[];
}

const keywords = new Set([
  "namespace",
  "public",
  "class",
  "enum",
  "get",
  "set",
  "using",
  "partial",
]);

export interface LexResult {
  tokens: Token[];
  comments: CommentTrivia[];
}

export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const comments: CommentTrivia[] = [];
  let pendingComments: CommentTrivia[] = [];
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  let lastToken: Token | undefined;

  const addToken = (kind: TokenKind, text: string, start: number, end: number) => {
    const token: Token = {
      kind,
      text,
      start,
      end,
      leadingComments: pendingComments,
      trailingComments: [],
    };
    pendingComments = [];
    tokens.push(token);
    lastToken = token;
  };

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (source.startsWith("///", i)) {
      const start = i;
      i += 3;
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++;
      const comment = { kind: "doc" as const, text: source.slice(start, i), start, end: i };
      comments.push(comment);
      pendingComments.push(comment);
      continue;
    }

    if (source.startsWith("//", i)) {
      const start = i;
      i += 2;
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++;
      const comment = { kind: "line" as const, text: source.slice(start, i), start, end: i };
      comments.push(comment);
      if (lastToken && isSameLine(source, lastToken.end, start)) {
        lastToken.trailingComments.push(comment);
      } else {
        pendingComments.push(comment);
      }
      continue;
    }

    if (source.startsWith("/*", i)) {
      const start = i;
      i += 2;
      while (i < source.length && !source.startsWith("*/", i)) i++;
      if (i >= source.length) throw new Error("Unterminated block comment");
      i += 2;
      const comment = { kind: "block" as const, text: source.slice(start, i), start, end: i };
      comments.push(comment);
      pendingComments.push(comment);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i++;
      let value = quote;
      while (i < source.length) {
        const c = source[i++];
        value += c;
        if (c === "\\") {
          value += source[i++] ?? "";
          continue;
        }
        if (c === quote) break;
      }
      if (!value.endsWith(quote)) throw new Error(`Unterminated string literal at ${start}`);
      addToken("string", value, start, i);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i++;
      const text = source.slice(start, i);
      addToken(keywords.has(text) ? "keyword" : "identifier", text, start, i);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[0-9.]/.test(source[i])) i++;
      addToken("number", source.slice(start, i), start, i);
      continue;
    }

    addToken("punctuation", ch, i, i + 1);
    i++;
  }

  tokens.push({
    kind: "eof",
    text: "",
    start: source.length,
    end: source.length,
    leadingComments: pendingComments,
    trailingComments: [],
  });
  return { tokens, comments };
}

function isSameLine(source: string, from: number, to: number): boolean {
  return !source.slice(from, to).includes("\n") && !source.slice(from, to).includes("\r");
}
