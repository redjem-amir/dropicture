// dropicture/apps/saas/backend/.lintstagedrc.mjs
export default {
  "*.ts": "eslint --fix",
  "package.json": () => "bun install --frozen-lockfile --no-cache",
};