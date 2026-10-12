// 開発ツール（ショットマップ・詰まり検出）用。通常のテストには含めない。
// 使い方: STAGE=modern npx vitest run -c tests/tools/vitest.config.mts tests/tools/shotmap.test.ts --silent=false
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/tools/**/*.test.ts'], testTimeout: 900000 } });
