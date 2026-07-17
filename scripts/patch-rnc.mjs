// Postinstall patch: force react-native-calendars to use its compiled JS entry,
// because its shipped src/index.ts references submodule paths without extensions
// that only exist as .js files (breaks Metro's TypeScript-first resolution).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const pkgPath = 'node_modules/react-native-calendars/package.json';

if (!existsSync(pkgPath)) {
  console.log('[patch-rnc] react-native-calendars not installed, skipping');
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.main !== 'src/index.js') {
  pkg.main = 'src/index.js';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch-rnc] Patched react-native-calendars main -> src/index.js');
} else {
  console.log('[patch-rnc] Already patched');
}
