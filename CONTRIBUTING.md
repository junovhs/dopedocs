# Contributing to dopedocs

Read [AGENTS.md](./AGENTS.md) before changing code. Track issues, plans and
engineering decisions through the connected Ishoo tools. See
[RELEASING.md](./RELEASING.md) for tag-based publishing.

## Treat the Ishoo store as public

This repository is public. Ishoo publishes its store on `refs/ishoo/store`.
Anyone who can read the repository can fetch that ref, including older issue
and decision text. `.ishoo/` being gitignored does not make its contents private.
An edit or deletion in the current record does not erase previously published
versions, and rewriting a remote ref cannot retract somebody else's copy.

Write public engineering material: reproducible bugs, minimal synthetic
examples, acceptance checks, technical tradeoffs and announced product behavior.
Use fictional names and `.example` URLs when real customer details are not
needed. Write every issue, comment, plan and ADR as something that may be quoted.

Keep these out of the store and public repository:

- Credentials, tokens, keys, recovery codes and private connection URLs.
- Customer identities, private correspondence, support exports and personal data.
- Unannounced pricing, commercial terms, financial information and sales plans.
- Unannounced business plans, confidential agreements and private vulnerability details.

Keep those in an approved private system; record only a non-sensitive summary
and the fact that private follow-up is needed. Do not put the private material
in a title, attachment name, URL, fact `note`, commit message or resolution as a
workaround. A public Git ref is a backup, not a confidentiality boundary.

## If something private was recorded

Stop repeating the value. Tell the owner privately using an already-authorized
private channel, or ask them to choose one without including the content in
the request. Revoke an exposed credential promptly through its provider; history
redaction is not a substitute for rotation.

Use Ishoo tools to correct current issue/decision text. Preserve only a sanitized
incident summary in public. Do not edit `.ishoo/` files directly, rewrite refs,
force-push history or create a public backup of the sensitive history.

The owner must review and explicitly authorize any history rewrite. The
[current redaction plan](./docs/store-redaction-plan.md) describes the proposed
work and its limits. It has not been executed.

## Contributions and licensing

The current package is MIT; see [LICENSE](./LICENSE). Do not submit content or
code you lack permission to contribute. The proposed 2.0 licence switch is
deferred. No new contributor agreement is established by this document.
