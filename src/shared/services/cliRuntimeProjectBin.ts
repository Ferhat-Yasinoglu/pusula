import path from "path";

/**
 * Project-local bin directories (`<pkg>/node_modules/.bin`) are not install locations for
 * user CLIs. `npm run` prepends them to PATH and the login-shell PATH inherits that, so a
 * package's bin can shadow a real tool: the `cn` class-name helper that fumadocs-ui pulls
 * in made Continue (`cn`) look installed on every npm-started dev server.
 *
 * Dropped from the lookup PATH only; spawns of resolved CLIs are unaffected.
 */
const PROJECT_BIN_DIR = /(^|[\\/])node_modules[\\/]\.bin[\\/]?$/;

export const dropProjectBinDirs = (pathValue: string): string =>
  pathValue
    .split(path.delimiter)
    .filter((entry) => !PROJECT_BIN_DIR.test(entry.trim()))
    .join(path.delimiter);
