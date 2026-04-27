# CI/CD

Migrations are safe to run automatically as part of a deploy pipeline. The state is stored in MongoDB, so re-running `migrate up` against an already-migrated database is a no-op — only pending migrations are applied.

::: warning
Always run migrations **before** deploying new application code. Rolling back application code without rolling back migrations can cause schema mismatches. Plan rollback steps when writing the `down` function of any destructive migration.
:::

## Environment Variables

Set `MIGRATE_DB_CONNECTION_URI` as a secret in your CI/CD environment. All examples below assume this variable is available.

## GitHub Actions

Run migrations as a step in a deployment workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - run: npm ci

      - name: Run migrations
        run: npx migrate up
        env:
          MIGRATE_DB_CONNECTION_URI: ${{ secrets.MIGRATE_DB_CONNECTION_URI }}

      # Deploy application after migrations succeed
      - name: Deploy application
        run: ./scripts/deploy.sh
```

## GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - migrate
  - deploy

run-migrations:
  stage: migrate
  image: node:22-alpine
  script:
    - npm ci
    - npx migrate up
  only:
    - main

deploy-app:
  stage: deploy
  script:
    - ./scripts/deploy.sh
  needs: [run-migrations]
  only:
    - main
```

## Docker — Init Container (Kubernetes)

A common pattern in Kubernetes is to run migrations in an [init container](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/) before the application container starts. The init container exits before the app pod receives traffic:

```yaml
# kubernetes/deployment.yaml
spec:
  initContainers:
    - name: run-migrations
      image: your-org/your-app:latest
      command: ['npx', 'migrate', 'up']
      env:
        - name: MIGRATE_DB_CONNECTION_URI
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: db-connection-uri
  containers:
    - name: app
      image: your-org/your-app:latest
      # ...
```
