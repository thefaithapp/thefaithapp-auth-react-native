# TheFaithApp Auth for React Native

`@thefaithapp/auth-react-native` opens TheFaithApp-hosted member sign-in and
returns a member bearer token for the `v1` API. It handles callback setup, S256
PKCE, state validation, code exchange, secure session storage, authenticated
API requests, and logout.

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

## License

TheFaithApp Auth is available under the [MIT License](LICENSE).
