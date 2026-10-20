// Shared helper: pull every assertion matcher call out of a test file's text.
// A matcher call is ".toX(...)" or ".not.toX(...)" with its full argument list,
// e.g. `.toHaveText('Order placed')` or a multi-line `.toMatchAriaSnapshot(`...`)`.
// Locator changes inside expect(...) do not change the matcher, so healing a
// selector passes, while changing an expected value or deleting an assertion does not.

const MATCHER_START = /\.(?:not\s*\.\s*)?(?:resolves\s*\.\s*|rejects\s*\.\s*)?to[A-Z][A-Za-z]*\s*\(/g;

function scanCall(text, openIdx) {
  // openIdx points at "(". Return index just after the matching ")", skipping strings.
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++;
        i++;
      }
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return text.length;
}

export function extractMatchers(text) {
  const out = [];
  if (!text) return out;
  MATCHER_START.lastIndex = 0;
  let m;
  while ((m = MATCHER_START.exec(text))) {
    const open = m.index + m[0].length - 1;
    const end = scanCall(text, open);
    out.push(text.slice(m.index, end).replace(/\s+/g, ' ').trim());
  }
  return out;
}

// Matchers present in `before` that are missing (removed or changed) in `after`.
export function removedMatchers(before, after) {
  const counts = new Map();
  for (const x of extractMatchers(after)) counts.set(x, (counts.get(x) || 0) + 1);
  const removed = [];
  for (const x of extractMatchers(before)) {
    const n = counts.get(x) || 0;
    if (n > 0) counts.set(x, n - 1);
    else removed.push(x);
  }
  return removed;
}

export const TEST_FILE = /(?:\.(?:spec|test)\.[cm]?[jt]sx?$)|(?:\.setup\.[cm]?[jt]s$)/;
