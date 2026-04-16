# Releasing SDKs to npm

Both SDKs are published to npm under the `@zuzuflow` organization by GitHub
Actions when a matching version tag is pushed. Credentials are stored in the
`NPM_TOKEN` repo secret — no manual `npm publish` from anyone's laptop.

## One-time setup

1. **Create the `zuzuflow` npm org** at https://www.npmjs.com/org/create and
   add yourself as an admin.

2. **Generate an npm automation token:**
   - https://www.npmjs.com/settings/<your-user>/tokens → *Generate New Token*
   - Choose **Granular Access Token**
   - Scope to packages under `@zuzuflow/*` with **Read and Write** permission
   - Copy the token (you only see it once).

3. **Add it as a repo secret:**
   - GitHub repo → *Settings* → *Secrets and variables* → *Actions* → *New
     repository secret*
   - Name: `NPM_TOKEN`
   - Value: the token from step 2

## Cutting a release

Bump the version in the SDK's `package.json`, commit, tag, push.

### `@zuzuflow/nodejs-sdk`

```bash
# Bump version in sdk/nodejs-sdk/package.json (e.g. 0.1.0 → 0.1.1)
cd sdk/nodejs-sdk
npm version patch   # or minor / major — edits package.json + commits
cd ../..

# Tag must match the new package.json version
git tag nodejs-sdk-v0.1.1
git push origin main
git push origin nodejs-sdk-v0.1.1
```

Watch the Action run at *Actions* → *Publish nodejs-sdk*. The workflow will
fail fast if the tag version and `package.json` version don't match.

### `@zuzuflow/react-sdk`

```bash
cd sdk/react-sdk
npm version patch
cd ../..

git tag react-sdk-v0.1.1
git push origin main
git push origin react-sdk-v0.1.1
```

## First-time publish (0.1.0)

Same flow — tag `nodejs-sdk-v0.1.0` and `react-sdk-v0.1.0` from main, push.
No `npm version` needed for the initial release since the versions are already
`0.1.0`.

```bash
git tag nodejs-sdk-v0.1.0
git tag react-sdk-v0.1.0
git push origin nodejs-sdk-v0.1.0 react-sdk-v0.1.0
```

## Provenance

Both workflows publish with `--provenance`, which attaches a cryptographic
attestation linking each published version to its GitHub Actions build. The
npm package page will display a "Provenance" badge.

## Unpublishing

npm only allows unpublish within 72 hours of publishing and only if no other
package depends on it. Use `npm deprecate @zuzuflow/<pkg>@<version> "<msg>"`
instead — safer and permanent.

## Troubleshooting

**`EPUBLISHCONFLICT` / "You cannot publish over the previously published version"**
→ You're trying to republish the same version. Bump the version in
`package.json` and re-tag.

**`ENEEDAUTH` / "This command requires you to be logged in"**
→ `NPM_TOKEN` secret is missing, expired, or scoped wrong.

**Tag version mismatch**
→ The workflow's verification step rejected the tag because
`package.json` version doesn't match the tag suffix. Fix either and re-tag.
