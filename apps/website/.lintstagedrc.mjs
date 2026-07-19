// dropicture/apps/website/.lintstagedrc.mjs
export default {
  "*.{js,jsx,ts,tsx}": "eslint --fix",
  "package.json": () => "bun install --frozen-lockfile --no-cache",
};