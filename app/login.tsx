import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from './context/user';
import RedLogo from '../components/RedLogo';

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
        <View style={styles.logoWrap}>
          <RedLogo size={110} />
          <Text style={styles.tagline}>Zagreb bez čekanja</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Kako ti se zoveš?</Text>
          <Text style={styles.subtitle}>Koristit ćemo ovo ime kad prijaviš gužvu</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Npr. Marko, Ana..."
              placeholderTextColor="#9ca3af"
              value={ime}
              onChangeText={setIme}
              maxLength={30}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[styles.btn, !ime.trim() && styles.btnDisabled]}
            onPress={nastavi}
            disabled={!ime.trim()}
          >
            <Text style={styles.btnText}>Počni koristiti</Text>
            <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dc2626' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  tagline: { color: '#fca5a5', fontSize: 16, textAlign: 'center', marginTop: 10 },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#111827' },
  btn: { backgroundColor: '#dc2626', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { backgroundColor: '#fca5a5' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});