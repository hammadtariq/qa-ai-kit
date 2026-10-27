import { readFileSync } from 'node:fs';

/**
 * Logins per role, from `roles` in .qa/config.json:
 *
 *   "roles": { "admin": { "env": "QA_ADMIN" }, "staff": { "env": "QA_STAFF" } }
 *
 * reads QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD, QA_STAFF_EMAIL / QA_STAFF_PASSWORD, and saves each session to
 * playwright/.auth/<role>.json. Without `roles`, there is one role, "user", reading QA_USER_EMAIL /
 * QA_USER_PASSWORD as before. Every test's `page` starts as `defaultRole` (or the first role); other roles
 * come from the `asRole` and `apiAs` fixtures.
 */
export type QaRole = { name: string; env: string; authFile: string };

type QaConfig = { roles?: Record<string, { env?: string }> | null; defaultRole?: string | null };

function config(): QaConfig {
  try {
    return JSON.parse(readFileSync('.qa/config.json', 'utf8'));
  } catch {
    return {};
  }
}

export function qaRoles(): QaRole[] {
  const configured = config().roles;
  const roles = configured && Object.keys(configured).length ? configured : { user: { env: 'QA_USER' } };
  return Object.entries(roles).map(([name, r]) => ({
    name,
    env: r?.env ?? `QA_${name.toUpperCase().replace(/\W+/g, '_')}`,
    authFile: `playwright/.auth/${name}.json`,
  }));
}

export function qaRole(name: string, setting = 'role'): QaRole {
  const all = qaRoles();
  const found = all.find((r) => r.name === name);
  if (!found) throw new Error(`Unknown ${setting} "${name}". Roles in .qa/config.json: ${all.map((r) => r.name).join(', ')}`);
  return found;
}

/** The role every test's `page` starts as: `defaultRole` if set (it must be one of the roles), else the first role. */
export function defaultRole(): QaRole {
  const name = config().defaultRole;
  return name ? qaRole(name, 'defaultRole') : qaRoles()[0];
}
