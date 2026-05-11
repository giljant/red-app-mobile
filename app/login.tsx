import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useUser } from './context/user';

export default function LoginScreen() {
  const [ime, setIme] = useState('');
  const { setUsername } = useUser();
  const router = useRouter();

  async function nastavi() {
    if (!ime.trim()) return;
    await setUsername(ime.trim());
    await import('@react-native-async-storage/async-storage')
      .then(m => m.default.setItem('onboarding_done', 'true'));
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>RED</Text>
        <Text style={styles.tagline}>Zagreb bez čekanja</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Kako ti se zoveš?</Text>
          <Text style={styles.subtitle}>Koristit ćemo ovo ime kad prijaviš gužvu</Text>
          <TextInput
            style={styles.input}
            placeholder="Npr. Marko, Ana..."
            placeholderTextColor="#9ca3af"
            value={ime}
            onChangeText={setIme}
            maxLength={30}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.btn, !ime.trim() && styles.btnDisabled]}
            onPress={nastavi}
            disabled={!ime.trim()}
          >
            <Text style={styles.btnText}>Počni koristiti →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dc2626' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { color: 'white', fontSize: 56, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 },
  tagline: { color: '#fca5a5', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 16, color: '#111827', marginBottom: 16 },
  btn: { backgroundColor: '#dc2626', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#fca5a5' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});