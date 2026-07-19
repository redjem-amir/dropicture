// dropicture/apps/saas/jobs/.lintstagedrc.mjs
export default {
  "*.ts": "eslint --fix",
  "package.json": () => "bun install --frozen-lockfile --no-cache",
};