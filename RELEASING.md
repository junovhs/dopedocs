# Releasing dopedocs

dopedocs is published to npm by GitHub Actions, never from a laptop. Pushing a
version tag is the whole release: no npm token, no passkey, no particular
computer.

## Cut a release

1. Set `"version"` in `package.json` to the new version (and run `npm install`
   so `package-lock.json` agrees). Commit and push to `main`.
2. Push a tag that matches, with a leading `v`:

   ```sh
   git tag v0.4.1
   git push origin v0.4.1
   ```

   Without a terminal (from home, or a phone): on github.com, open the repo,
   choose **Releases → Draft a new release**, type the new tag (e.g. `v0.4.1`)
   and publish the release. That creates the tag and starts the same run.
3. Watch the `release` run under the repo's **Actions** tab. It runs
   `npm ci`, `npm run check`, `npm test` and `npm run build`, then
   `npm publish --provenance --access public`. When it is green, the version is
   on npm as `latest`.

The tag must name a version that is not on npm yet. npm refuses to republish a
version, so a tag for an already-published version fails at the last step.

## How it works

The workflow is `.github/workflows/release.yml`. It publishes by npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers): npm is told to
trust that one workflow file in `junovhs/dopedocs`, and GitHub proves the run's
identity with a short-lived OIDC token (the job's `id-token: write`
permission). There is no `NPM_TOKEN` secret, so nothing expires.

The trust is set on npm, not in the repo. To see it:

```sh
npm trust list dopedocs
```

It should list `type: github`, `file: release.yml`,
`repository: junovhs/dopedocs`. Trusted publishing needs npm 11.5.1 or later,
which is why the workflow upgrades npm before installing.

## If a release fails

- **Tests, check or build fail:** fix on `main`, bump to a new version, tag
  again. A failed run publishes nothing.
- **Publish fails with 401/403 or "not authorized":** the trust on npm is
  missing or does not match. Renaming `release.yml`, moving it, or renaming or
  transferring the repository all break the match. Re-register it (needs the
  npm account owner's passkey once):

  ```sh
  npm trust github dopedocs --file release.yml --repo junovhs/dopedocs --allow-publish
  ```

- **Publish fails with "cannot publish over the previously published
  version":** the tag's version is already on npm. Bump and tag again.

## Do not publish locally

`npm publish` from a working copy is the fallback of last resort, not the
path. It ships whatever is in that working copy, and the npm account requires
a passkey for every local publish.
