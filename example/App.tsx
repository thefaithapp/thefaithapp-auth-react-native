import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  TheFaithAppAuth,
  TheFaithAuthError,
  type TheFaithAuthSession,
} from '@thefaithapp/auth-react-native'

const apiKey = process.env.EXPO_PUBLIC_THEFAITHAPP_API_KEY?.trim() ?? ''

export default function App() {
  const auth = useMemo(
    () => (apiKey ? new TheFaithAppAuth({ apiKey }) : null),
    [],
  )
  const [callbackUri, setCallbackUri] = useState('Reading application ID…')
  const [session, setSession] = useState<TheFaithAuthSession | null>(null)
  const [status, setStatus] = useState(
    apiKey ? 'Ready to sign in.' : 'Add EXPO_PUBLIC_THEFAITHAPP_API_KEY to continue.',
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!auth) return

    void Promise.all([auth.callbackUri, auth.currentSession()])
      .then(([callback, savedSession]) => {
        setCallbackUri(callback)
        setSession(savedSession)
        setStatus(
          savedSession
            ? 'Restored the saved member session.'
            : 'Ready to sign in.',
        )
      })
      .catch((error: unknown) => setStatus(messageFor(error)))
  }, [auth])

  const signIn = async () => {
    if (!auth) return
    setBusy(true)
    try {
      const nextSession = await auth.signIn()
      setSession(nextSession)
      setStatus(`Signed in as ${nextSession.member.name}.`)
    } catch (error) {
      setStatus(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  const callUser = async () => {
    if (!auth) return
    setBusy(true)
    try {
      const response = await auth.authorizedFetch('/v1/user')
      if (!response.ok) {
        throw new Error(`The API returned HTTP ${response.status}.`)
      }
      setStatus(`GET /v1/user returned HTTP ${response.status}.`)
    } catch (error) {
      setStatus(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!auth) return
    setBusy(true)
    try {
      await auth.signOut()
      setSession(null)
      setStatus('Signed out and removed the saved session.')
    } catch (error) {
      setStatus(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>THEFAITHAPP</Text>
        <Text style={styles.title}>React Native Auth</Text>
        <Text style={styles.subtitle}>
          Production hosted sign-in and authenticated v1 API access.
        </Text>

        <Card label="Callback" value={callbackUri} />
        <Card
          label="Member session"
          value={
            session
              ? `${session.member.name}\n${session.member.email ?? 'No email'}`
              : 'Not signed in'
          }
        />

        <View style={styles.actions}>
          <ActionButton
            label="Sign in"
            onPress={signIn}
            disabled={!auth || busy}
            primary
          />
          <ActionButton
            label="Call /v1/user"
            onPress={callUser}
            disabled={!session || busy}
          />
          <ActionButton
            label="Sign out"
            onPress={signOut}
            disabled={!session || busy}
          />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeading}>
            <Text style={styles.label}>Status</Text>
            {busy ? <ActivityIndicator size="small" color="#345D4B" /> : null}
          </View>
          <Text style={styles.status}>{status}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  )
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary = false,
}: {
  label: string
  onPress: () => void
  disabled: boolean
  primary?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  )
}

function messageFor(error: unknown): string {
  if (error instanceof TheFaithAuthError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F2EA' },
  container: { padding: 24, paddingBottom: 48, gap: 16 },
  eyebrow: {
    color: '#977447',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  title: { color: '#1E2C25', fontSize: 34, fontWeight: '800' },
  subtitle: { color: '#66736C', fontSize: 16, lineHeight: 23, marginBottom: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5DED0',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  label: {
    color: '#977447',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  value: { color: '#25342C', fontSize: 15, lineHeight: 22 },
  actions: { gap: 10 },
  button: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#345D4B',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButton: { backgroundColor: '#345D4B' },
  buttonText: { color: '#345D4B', fontSize: 16, fontWeight: '700' },
  primaryButtonText: { color: '#FFFFFF' },
  disabledButton: { opacity: 0.42 },
  pressedButton: { opacity: 0.76 },
  statusCard: {
    backgroundColor: '#E8EFEA',
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  statusHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  status: { color: '#345D4B', fontSize: 15, lineHeight: 22 },
})
