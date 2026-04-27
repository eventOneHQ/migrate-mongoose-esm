<div align="center">

# @eventonehq/migrate-mongoose

**A migration framework for Mongoose**

[![npm version](https://img.shields.io/npm/v/@eventonehq/migrate-mongoose?style=flat-square&color=crimson)](https://www.npmjs.com/package/@eventonehq/migrate-mongoose)
[![npm downloads](https://img.shields.io/npm/dm/@eventonehq/migrate-mongoose?style=flat-square)](https://www.npmjs.com/package/@eventonehq/migrate-mongoose)
[![Node.js](https://img.shields.io/node/v/@eventonehq/migrate-mongoose?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A database migration framework built for projects already using Mongoose. Migration state lives in MongoDB — no local state files, no fragile lock mechanisms, works anywhere your database does.

</div>

---

## Installation

```sh
npm install @eventonehq/migrate-mongoose mongoose
```

## Quick Start

```sh
# Create a migration
npx migrate create add_users -d mongodb://localhost:27017/mydb

# Run pending migrations
npx migrate up -d mongodb://localhost:27017/mydb

# Check status
npx migrate list -d mongodb://localhost:27017/mydb
```

For full documentation, visit the **[docs site](https://eventonehq.github.io/migrate-mongoose-esm/)**.

---

## How to Contribute

Contributions are welcome. To get started:

1. **Open an issue** to discuss the proposed change before writing code.
2. **Fork the repository** and create a feature branch.
3. **Write tests** for your changes — all tests must pass (`npm test`).
4. **Submit a pull request** against the `main` branch. It will be reviewed and iterated on together.
5. Once approved, it will be merged and the package version will be bumped.

---

## Acknowledgements

- [migrate-mongoose](https://github.com/balmasi/migrate-mongoose) — the original library that inspired this project.

---

## License

MIT — see [LICENSE](LICENSE) for details.
