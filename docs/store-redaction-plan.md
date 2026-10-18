# Public Ishoo history: redaction plan for review

Status: prepared on 2026-10-18 under SEC-01. **No history rewrite is authorized
or performed.** The owner requested a plan for review. The current release
stays MIT, and the separate 2.0 licence switch is deferred.

## Evidence and boundary

`gh repo view junovhs/dopedocs --json visibility,url` reports `PUBLIC`.
`git ls-remote origin refs/ishoo/store` returns a published store ref. The
[contributor rule](../CONTRIBUTING.md) now explains why the store is public and
what must never be recorded there.

A targeted read-only history scan of the DEC-08 and SEC-01 records found four
relevant revisions and five decodable record versions. Two decoded versions
contained currency amounts. Those amounts are deliberately not repeated here.
No recognized npm/GitHub token or private-key markers appeared in that targeted
scan. This is **not a full secret audit**: arbitrary secrets, customer details
or indirect disclosures would need a broader review.

The scan used `git show <commit>:<record-path>` and `zstd -d -c` on captured
bytes, never the working store. The `.rec` serialization is not plain JSON;
future checks must use an Ishoo-aware decoder and inspect decoded record values,
not assume a raw Git grep can see compressed history.

The objective is to stop serving the identified commercial values from the
repository's authoritative store history. It cannot make earlier public copies,
third-party caches or anybody's local clone private.

## Proposed retention and destination

Keep engineering issues, decisions and their useful current state publicly
available, using the existing remote as the durable backup. Remove commercial
values from the current records through Ishoo tools and replace the published
store ancestry with a reviewed clean snapshot. This trades historical store
blame/audit chronology for a smaller, verifiable redaction boundary; code history
on `main` and release tags stay intact.

This is a proposal, not a decision to retain the old disclosure. If the owner
wants to retain the engineering chronology instead, use a supported history-wide
record rewrite and verify every retained revision. If the owner wants a private
store mirror, select its approved destination and access policy before any move.
A private mirror does not remove the old public ref or previously fetched copies.

## Preparation before approval

1. Inventory every remote and local ref that may retain store objects, including
   other published store snapshots. Enumerate actual refs rather than assuming
   `refs/ishoo/store` is the only route. Do not print historical record contents
   into a public issue or terminal transcript.
2. Agree on the exact sensitive fields and detection rules with the owner in a
   private review. Search current and historical decoded records for the values
   and variants; include issue comments/resolutions, not just DEC-08. Keep a
   sanitized count report and opaque record identifiers in the public issue.
3. Coordinate with all human/agent writers and the Ishoo hub. Pause mutations
   during final snapshot generation and ref replacement. Identify which clients
   must discard/reinitialize stale store state before reconnecting so a later
   merge does not restore the old history.
4. Decide whether a recovery copy is required. If so, encrypt it and keep it in
   an owner-approved private location outside this repository and public remotes,
   with a retention/deletion policy. No public backup ref or tag may retain the
   withdrawn history.
5. Correct current records through `ishoo_*` tools. Do not hand-edit serialized
   `.ishoo/` files. Recheck accepted decisions, linked records and issue counts.
6. Build and validate the proposed clean store in a disposable isolated clone,
   with a tool that understands the current Ishoo record format. It must preserve
   identifiers and relationships while producing no parent link to sensitive
   ancestry. Keep source and candidate ref identities in the private review.

## Tooling prerequisite

The connected Ishoo tools currently expose record edits and conflict repair,
but no supported history-redaction operation. The implementation must first
provide or obtain an Ishoo-supported maintenance procedure that safely quiesces
writers, validates serialization and rebuilds store authority. Do not improvise
by editing compressed records or replacing the live ref while the hub runs.
This prerequisite must be resolved before requesting execution approval.

## Exact approval boundary

Return to the owner with a review package containing:

- The old remote tip and proposed candidate tip.
- The selected sensitive-record identifiers and sanitized before/after counts.
- The chosen history-retention strategy and store destination.
- The supported execution procedure, writer coordination and recovery plan.
- Evidence that the isolated candidate passes the verification below.

Ask the owner to approve replacing the **specific** published store ref(s) and
retiring any other reachable public copies under our control. That action changes
shared history and may remove audit chronology. Do not infer approval from this
plan, routine code-merge authority or the earlier request to finish issues.

## Execution after a separate approval

Use only the reviewed Ishoo-supported procedure, with writers quiescent. Confirm
the remote tip still equals the reviewed expected tip; abort and regenerate the
candidate if it changed. Publish with an exact force-with-lease expectation,
never an unconditional force push. Retire additional retaining refs only if
specifically approved. Reinitialize hub/client store state before resuming writes.
No `main` history, package version, npm release tag or licence changes belong here.

## Verification and resumption

From a fresh disposable clone, fetch the same public ref(s) a stranger can fetch.
Enumerate every reachable store commit and decode every retained record version.
Run the privately approved value/variant detectors and record zero remaining
matches for the selected data, without printing the data. Inspect all other
remote refs that could retain that ancestry. Repository-side garbage collection
and hosting caches may require provider assistance; do not promise immediate
object erasure from a successful ref update alone.

Open the sanitized store through Ishoo and verify decision/issue identifiers,
links, statuses and health. Run a harmless approved store mutation and repeat
the fresh-clone check to prove synchronization did not reintroduce old ancestry.
Confirm `main` and `v0.5.0` still identify their original code commits.

Resume writers only after these checks pass. Record the approved action, tips,
counts, checks and limitations in a sanitized SEC-01 execution follow-up.

## Recovery

Before publishing, a failed candidate is disposable: keep the authoritative
remote unchanged and correct the isolated procedure. After publishing, stop
writers if validation fails. Prefer restoring a verified sanitized snapshot.
Restoring the old unredacted store would republish the disclosure and requires
new explicit owner approval; a private recovery copy is not permission to do so.
