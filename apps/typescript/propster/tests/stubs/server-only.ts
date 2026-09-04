/**
 * Test stub for the `server-only` package.
 *
 * `server-only` throws on import outside a React Server Component, which is
 * exactly the guarantee we want in the app and exactly what blocks unit testing
 * server modules. Vitest aliases the package to this no-op so server code can
 * be tested directly; the real guard still applies to every build.
 */
export {};
