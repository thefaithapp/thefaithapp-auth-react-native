const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const sdkRoot = path.resolve(
  projectRoot,
  '..',
)

const config = getDefaultConfig(projectRoot)

const appEntryPoint = path.resolve(projectRoot, 'index.ts')
const appRuntimePackages = new Set([
  'expo',
  'expo-application',
  'expo-crypto',
  'expo-secure-store',
  'expo-web-browser',
  'react',
  'react-native',
])

function packageNameFromSpecifier(moduleName) {
  const parts = moduleName.split('/')

  return moduleName.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// The example links the SDK source during repository development. Resolve all
// runtime dependencies from this app so Metro cannot bundle the SDK's local
// development copies of React, React Native, or Expo.
config.watchFolders = [...new Set([...config.watchFolders, sdkRoot])]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const packageName = packageNameFromSpecifier(moduleName)

  if (appRuntimePackages.has(packageName)) {
    return context.resolveRequest(
      { ...context, originModulePath: appEntryPoint },
      moduleName,
      platform,
    )
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
