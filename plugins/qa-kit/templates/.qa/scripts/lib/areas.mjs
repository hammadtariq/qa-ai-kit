// Product areas and the source paths that belong to each (`areas` in .qa/config.json), so a PR runs the tests of
// the areas it touches: { "purchases": ["src/purchases/**", "app/api/purchases/**"] }. Tests carry @area-<name>.

const NAME = /^[a-z0-9][a-z0-9-]*$/;

// The configured areas as { name: [patterns] }, or {} when unset. Throws on a name a tag can't carry.
export function areasOf(cfg) {
  const areas = cfg.areas || {};
  for (const [name, paths] of Object.entries(areas)) {
    if (!NAME.test(name)) throw new Error(`areas: "${name}" must be lower-case letters, digits and dashes (it becomes the tag @area-${name})`);
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string')) throw new Error(`areas.${name}: expected a list of paths`);
  }
  return areas;
}

// A path glob as a RegExp: ** spans folders, * and ? stay within one. A plain path also matches what's below it.
export function globToRegExp(glob) {
  const g = glob.replace(/^\.\//, '');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      i++;
      if (g[i + 1] === '/') {
        i++;
        re += '(?:.*/)?';
      } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(/[*?]/.test(g) ? `^${re}$` : `^${re.replace(/\/$/, '')}(?:/.*)?$`);
}

// Which areas the changed files touch, and the files that belong to no area.
export function touchedAreas(files, areas) {
  const matchers = Object.entries(areas).map(([name, paths]) => [name, paths.map(globToRegExp)]);
  const touched = new Set();
  const outside = [];
  for (const file of files) {
    const hits = matchers.filter(([, res]) => res.some((re) => re.test(file))).map(([name]) => name);
    hits.forEach((n) => touched.add(n));
    if (!hits.length) outside.push(file);
  }
  return { touched: [...touched].sort(), outside };
}

// A Playwright --grep for the smoke tests plus the touched areas' tests (whole tags only: @area-pay, not @area-payroll).
export const grepFor = (touched) => (touched.length ? `@smoke|@area-(?:${touched.join('|')})(?![\\w-])` : '@smoke');
