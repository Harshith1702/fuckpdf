export type TokenType =
  | "number"
  | "name"
  | "string"
  | "hex-string"
  | "array-start"
  | "array-end"
  | "dict-start"
  | "dict-end"
  | "operator";

export interface Token {
  type: TokenType;
  raw: string;
  value: string | number;
  start: number;
  end: number;
}

function isWhitespace(ch: string | undefined): boolean {
  if (!ch) return false;
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\0";
}

function isDelimiter(ch: string | undefined): boolean {
  if (!ch) return false;
  return (
    ch === "(" ||
    ch === ")" ||
    ch === "<" ||
    ch === ">" ||
    ch === "[" ||
    ch === "]" ||
    ch === "{" ||
    ch === "}" ||
    ch === "/" ||
    ch === "%"
  );
}

export function decodePdfLiteralString(raw: string): string {
  // raw includes outer '(' and ')'
  const inner = raw.slice(1, -1);
  let result = "";
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === "\\") {
      i++;
      if (i >= inner.length) break;
      const next = inner[i];
      if (next === "n") result += "\n";
      else if (next === "r") result += "\r";
      else if (next === "t") result += "\t";
      else if (next === "b") result += "\b";
      else if (next === "f") result += "\f";
      else if (next === "(") result += "(";
      else if (next === ")") result += ")";
      else if (next === "\\") result += "\\";
      else if (next && next >= "0" && next <= "7") {
        // Octal escape up to 3 digits
        let octal = next;
        const d2 = inner[i + 1];
        if (d2 && d2 >= "0" && d2 <= "7") {
          i++;
          octal += d2;
          const d3 = inner[i + 1];
          if (d3 && d3 >= "0" && d3 <= "7") {
            i++;
            octal += d3;
          }
        }
        result += String.fromCharCode(parseInt(octal, 8));
      } else if (next === "\r") {
        if (inner[i + 1] === "\n") i++;
      } else if (next === "\n") {
        // Line continuation
      } else if (next) {
        result += next;
      }
    } else if (ch) {
      result += ch;
    }
    i++;
  }
  return result;
}

export function encodePdfLiteralString(str: string): string {
  let escaped = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "(") escaped += "\\(";
    else if (ch === ")") escaped += "\\)";
    else if (ch === "\\") escaped += "\\\\";
    else if (ch === "\r") escaped += "\\r";
    else if (ch === "\n") escaped += "\\n";
    else escaped += ch;
  }
  return `(${escaped})`;
}

export function decodePdfHexString(raw: string): string {
  let hex = raw.slice(1, -1).replace(/\s+/g, "");
  if (hex.length % 2 !== 0) {
    hex += "0";
  }
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    result += String.fromCharCode(byte);
  }
  return result;
}

export function tokenizeContentStream(content: string): Token[] {
  const tokens: Token[] = [];
  const len = content.length;
  let i = 0;

  while (i < len) {
    const ch = content[i];

    // Whitespace
    if (isWhitespace(ch)) {
      i++;
      continue;
    }

    // Comment
    if (ch === "%") {
      while (i < len && content[i] !== "\n" && content[i] !== "\r") {
        i++;
      }
      continue;
    }

    const start = i;

    // Array start / end
    if (ch === "[") {
      tokens.push({ type: "array-start", raw: "[", value: "[", start, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "array-end", raw: "]", value: "]", start, end: i + 1 });
      i++;
      continue;
    }

    // Dictionary delimiters or hex string
    if (ch === "<") {
      if (i + 1 < len && content[i + 1] === "<") {
        tokens.push({ type: "dict-start", raw: "<<", value: "<<", start, end: i + 2 });
        i += 2;
        continue;
      }
      // Hex string <...>
      i++;
      while (i < len && content[i] !== ">") {
        i++;
      }
      if (i < len && content[i] === ">") {
        i++;
      }
      const raw = content.slice(start, i);
      tokens.push({
        type: "hex-string",
        raw,
        value: decodePdfHexString(raw),
        start,
        end: i,
      });
      continue;
    }

    if (ch === ">") {
      if (i + 1 < len && content[i + 1] === ">") {
        tokens.push({ type: "dict-end", raw: ">>", value: ">>", start, end: i + 2 });
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Literal string (...)
    if (ch === "(") {
      let depth = 1;
      i++;
      while (i < len && depth > 0) {
        if (content[i] === "\\") {
          i += 2;
          continue;
        }
        if (content[i] === "(") {
          depth++;
        } else if (content[i] === ")") {
          depth--;
        }
        i++;
      }
      const raw = content.slice(start, i);
      tokens.push({
        type: "string",
        raw,
        value: decodePdfLiteralString(raw),
        start,
        end: i,
      });
      continue;
    }

    // Name /Name
    if (ch === "/") {
      i++;
      while (i < len && !isWhitespace(content[i]) && !isDelimiter(content[i])) {
        i++;
      }
      const raw = content.slice(start, i);
      tokens.push({
        type: "name",
        raw,
        value: raw.slice(1),
        start,
        end: i,
      });
      continue;
    }

    // Number or Keyword / Operator
    let tokenStr = "";
    while (i < len && !isWhitespace(content[i]) && !isDelimiter(content[i])) {
      const cur = content[i];
      if (cur) tokenStr += cur;
      i++;
    }

    const num = Number(tokenStr);
    if (!isNaN(num) && tokenStr.trim() !== "") {
      tokens.push({
        type: "number",
        raw: tokenStr,
        value: num,
        start,
        end: i,
      });
    } else {
      tokens.push({
        type: "operator",
        raw: tokenStr,
        value: tokenStr,
        start,
        end: i,
      });
    }
  }

  return tokens;
}
