# TheFaithApp React Native Auth Example

This standalone Expo app consumes the local SDK checkout and exercises
callback resolution, hosted sign-in, secure session restoration,
authenticated `v1` access, and logout.

## Run

Register this callback in `Settings > Developer Access` using **Add React
Native app**:

```text
com.thefaithapp.reactauthsample.thefaithapp://auth/callback
```

Then provide the client API key and create a native development build:

```bash
export EXPO_PUBLIC_THEFAITHAPP_API_KEY="your-client-key"
npx expo run:ios
```

For Android:

```bash
export EXPO_PUBLIC_THEFAITHAPP_API_KEY="your-client-key"
npx expo run:android
```

The native `ios/` and `android/` folders are generated locally and ignored.
