# AGENTS

Guidance for AI agents working in this repo.

## Skills

Project-specific agent skills live under [`docs/skills/`](./docs/skills/).

| Skill                     | Path                                                                                             | When to use                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB migration & validation | [`docs/skills/db-migration-validation/SKILL.md`](./docs/skills/db-migration-validation/SKILL.md) | Adding or applying Drizzle migrations under `packages/db`, updating `meta/_journal.json`, running `pnpm --filter @forge/db db:migrate`, or validating that columns landed |

Read the relevant `SKILL.md` before performing that workflow.

## Related

- Contributor setup and layout: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Design docs: [`docs/rfcs/`](./docs/rfcs/README.md)
- Packaged runtime skills (workspace agents): [`packages/skills/`](./packages/skills/)
