const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins')
const packageJson = require('./package.json')

const callbackScheme = (applicationId) => {
  const normalized = String(applicationId || '').trim().toLowerCase()
  const scheme = `${normalized}.thefaithapp`

  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
    throw new Error(
      'TheFaithApp Auth requires a reverse-domain application ID containing only letters, numbers, dots, or hyphens.',
    )
  }

  return scheme
}

const withIosCallback = (config) =>
  withInfoPlist(config, (iosConfig) => {
    const scheme = callbackScheme(config.ios?.bundleIdentifier)
    const urlTypes = iosConfig.modResults.CFBundleURLTypes || []
    const alreadyRegistered = urlTypes.some((entry) =>
      entry.CFBundleURLSchemes?.includes(scheme),
    )

    if (!alreadyRegistered) {
      urlTypes.push({
        CFBundleURLName: scheme,
        CFBundleURLSchemes: [scheme],
      })
    }

    iosConfig.modResults.CFBundleURLTypes = urlTypes
    return iosConfig
  })

const withAndroidCallback = (config) =>
  withAndroidManifest(config, (androidConfig) => {
    const scheme = callbackScheme(config.android?.package)
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
      androidConfig.modResults,
    )
    const intentFilters = activity['intent-filter'] || []
    const alreadyRegistered = intentFilters.some((filter) =>
      filter.data?.some(
        (data) =>
          data.$?.['android:scheme'] === scheme &&
          data.$?.['android:host'] === 'auth',
      ),
    )

    if (!alreadyRegistered) {
      intentFilters.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
        ],
        data: [
          {
            $: {
              'android:scheme': scheme,
              'android:host': 'auth',
              'android:pathPrefix': '/callback',
            },
          },
        ],
      })
    }

    activity['intent-filter'] = intentFilters
    return androidConfig
  })

const withTheFaithAppAuth = (config) => {
  if (!config.ios?.bundleIdentifier || !config.android?.package) {
    throw new Error(
      'TheFaithApp Auth requires ios.bundleIdentifier and android.package in the Expo app config.',
    )
  }

  return withAndroidCallback(withIosCallback(config))
}

module.exports = createRunOncePlugin(
  withTheFaithAppAuth,
  packageJson.name,
  packageJson.version,
)
