// dropicture/.lintstagedrc.mjs
export default {
  "**/*.{tf,tfvars}": (files) => files.map((f) => `terraform fmt ${f}`),
};