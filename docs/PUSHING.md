Preparing and pushing this repository safely

1) Enable git hooks (recommended):

   ```bash
   git config core.hooksPath .githooks
   ```

2) Run the local secret scanner (optional, runs automatically from pre-push):

   ```bash
   node scripts/check-secrets.mjs
   ```

3) Add your remote and push (example):

   ```bash
   git remote add origin https://github.com/bigskima/Cot-church-Project.git
   git push -u origin main
   ```

Notes:
- This repo uses secret references (database `secret_reference` columns) and expects secrets to be provided by the deployment environment. Do not commit raw secrets.
- The `check-secrets.mjs` is a quick scanner and not a substitute for a full secret-management policy. Use vendor tooling (GitHub secret scanning, pre-commit frameworks) if you want stricter checks.
