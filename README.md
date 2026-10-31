# TheFaithApp Auth for React Native

`@thefaithapp/auth-react-native` opens TheFaithApp-hosted member sign-in and
returns a member bearer token for the `v1` API. It handles callback setup, S256
PKCE, state validation, code exchange, secure session storage, authenticated
API requests, and logout.

## Documentation

- [React Native SDK quickstart](https://docs.thefaithapp.com/api-reference/react-native-sdk)
- [Hosted authentication guide](https://docs.thefaithapp.com/api-reference/hosted-auth)
- [Standalone example app](https://github.com/thefaithapp/thefaithapp-auth-react-native/tree/main/example)

## Install

```bash
npm install @thefaithapp/auth-react-native
npx expo install expo-application expo-crypto expo-secure-store expo-web-browser
```

Add the package's config plugin to `app.json` and set the same reverse-domain
identifier for iOS and Android:

```json
{
  "expo": {
    "plugins": ["@thefaithapp/auth-react-native"],
    "ios": {
      "bundleIdentifier": "com.example.church"
    },
    "android": {
      "package": "com.example.church"
    }
  }
}
```

The callback for this application is:

```text
com.example.church.thefaithapp://auth/callback
```

In `Settings > Developer Access`, select **Add React Native app** and enter
`com.example.church.thefaithapp`. If the iOS and Android identifiers differ,
register both callbacks.

After adding the plugin, create a development build or rebuild the native app.
The custom callback cannot be added to an already-installed Expo Go binary.

## Sign in

```tsx
import { TheFaithAppAuth } from '@thefaithapp/auth-react-native'

const auth = new TheFaithAppAuth({ apiKey: 'your-client-key' })
const callback = await auth.callbackUri
const session = await auth.signIn()

console.log(session.member.name)
// Use session.accessToken only when direct token access is required.
```

Do not log or include `session.accessToken` in crash reports.

## Call the v1 API

```tsx
const response = await auth.authorizedFetch('/v1/user')
const profile = await response.json()
```

## Restore and sign out

```tsx
const savedSession = await auth.currentSession()
await auth.signOut()
```

See the example app in the repository for a complete integration.

## Local SDK development

When building this package from source for an isolated development app, set
both origins at build time:

```bash
npm run build -- \
  --env.TFA_API_BASE_URL http://127.0.0.1:8000 \
  --env.TFA_HOSTED_AUTH_BASE_URL http://127.0.0.1:3001
```

Origins must use HTTPS, except HTTP on loopback, and cannot contain credentials,
paths, queries, or fragments. Register the development app's callback and use
its test church's client key. Build without these overrides for production.

## License

TheFaithApp Auth is available under the [MIT License](LICENSE).

## Development dependency security

Use Node 22 LTS (22.18+) or Node 24 LTS (24.11+) for source builds.
When building from a source checkout, run `npm ci --ignore-scripts`, then
`npm run security:prepare` before using Expo tooling. Run `npm run security:check`
for the complete dependency audit. `npm test` also tests the audit policy.

Zod and esbuild use patched versions. Until node-forge publishes its fix for
CVE-2026-85393, the development script backports the nested DigestAlgorithm
validation from [upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152).
It checks the original source hash, verifies the patched file, and tests valid
and malformed RSA signatures. The audit accepts only that exact advisory for
copies that passed these checks; new advisories and modified files still fail.
Raw `npm audit` continues to report the unchanged upstream node-forge version.

This development helper is excluded from the published SDK archive. It does
not run an install hook in consumer apps. Consumer app maintainers must apply
their own dependency updates and tooling fixes; the giving example includes the
same checks.
