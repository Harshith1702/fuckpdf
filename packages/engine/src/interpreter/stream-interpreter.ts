import { Token, tokenizeContentStream } from "../parser/tokenizer.js";

export interface TextRunInfo {
  operator: "Tj" | "TJ" | "'" | '"';
  operatorToken: Token;
  fontName: string | null;
  fontSize: number | null;
  text: string;
  operandTokens: Token[];
  startOffset: number;
  endOffset: number;
}

export function parseTextRuns(content: string): TextRunInfo[] {
  const tokens = tokenizeContentStream(content);
  const textRuns: TextRunInfo[] = [];

  let currentFontName: string | null = null;
  let currentFontSize: number | null = null;

  const stack: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.type === "operator") {
      const op = token.value as string;

      if (op === "BT") {
        stack.length = 0;
      } else if (op === "ET") {
        stack.length = 0;
      } else if (op === "Tf") {
        if (stack.length >= 2) {
          const sizeToken = stack[stack.length - 1];
          const fontToken = stack[stack.length - 2];
          if (sizeToken && typeof sizeToken.value === "number") {
            currentFontSize = sizeToken.value;
          }
          if (fontToken && fontToken.type === "name") {
            currentFontName = fontToken.value as string;
          }
        }
        stack.length = 0;
      } else if (op === "Tj") {
        if (stack.length >= 1) {
          const operandToken = stack[stack.length - 1];
          if (operandToken) {
            const text = typeof operandToken.value === "string" ? operandToken.value : String(operandToken.value);
            textRuns.push({
              operator: "Tj",
              operatorToken: token,
              fontName: currentFontName,
              fontSize: currentFontSize,
              text,
              operandTokens: [operandToken],
              startOffset: operandToken.start,
              endOffset: token.end,
            });
          }
        }
        stack.length = 0;
      } else if (op === "TJ") {
        if (stack.length >= 1) {
          let j = stack.length - 1;
          while (j >= 0 && stack[j]?.type !== "array-start") {
            j--;
          }
          const collected = stack.slice(j >= 0 ? j : stack.length - 1);
          let extractedText = "";
          for (const item of collected) {
            if (item.type === "string" || item.type === "hex-string") {
              extractedText += String(item.value);
            }
          }
          const startToken = collected[0] ?? token;
          textRuns.push({
            operator: "TJ",
            operatorToken: token,
            fontName: currentFontName,
            fontSize: currentFontSize,
            text: extractedText,
            operandTokens: collected,
            startOffset: startToken.start,
            endOffset: token.end,
          });
        }
        stack.length = 0;
      } else if (op === "'") {
        if (stack.length >= 1) {
          const operandToken = stack[stack.length - 1];
          if (operandToken) {
            const text = String(operandToken.value);
            textRuns.push({
              operator: "'",
              operatorToken: token,
              fontName: currentFontName,
              fontSize: currentFontSize,
              text,
              operandTokens: [operandToken],
              startOffset: operandToken.start,
              endOffset: token.end,
            });
          }
        }
        stack.length = 0;
      } else if (op === '"') {
        if (stack.length >= 1) {
          const operandToken = stack[stack.length - 1];
          if (operandToken) {
            const text = String(operandToken.value);
            const sliceStart = Math.max(0, stack.length - 3);
            const startToken = stack[sliceStart] ?? token;
            textRuns.push({
              operator: '"',
              operatorToken: token,
              fontName: currentFontName,
              fontSize: currentFontSize,
              text,
              operandTokens: stack.slice(sliceStart),
              startOffset: startToken.start,
              endOffset: token.end,
            });
          }
        }
        stack.length = 0;
      } else {
        stack.length = 0;
      }
    } else {
      stack.push(token);
    }
  }

  return textRuns;
}
