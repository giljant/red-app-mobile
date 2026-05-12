import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../context/user';

type Objava = {
  id: number;
  lokacija_naziv: string | null;
  tekst: string;
  username: string;
  timestamp: string;
};

const API = 'http://10.100.200.134:3000';

function vremeProšlo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'upravo';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function FeedScreen() {
  const [objave, setObjave] = useState<Objava[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tekst, setTekst] = useState('');
  const [šaljem, setŠaljem] = useState(false);
  const { username, logout } = useUser();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  useEffect(() => {
    ucitajObjave();
    const interval = setInterval(ucitajObjave, 30000);
    return () => clearInterval(interval);
  }, []);

  async function ucitajObjave() {
    try {
      const res = await fetch(`${API}/api/objave`);
      const data = await res.json();
      setObjave(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function posaljiObjavu() {
    if (!tekst.trim() || !username) return;
    setŠaljem(true);
    try {
      await fetch(`${API}/api/objave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tekst: tekst.trim(),
          username: username,
        }),
      });
      setTekst('');
      ucitajObjave();
    } catch (e) {
      console.error(e);
    } finally {
      setŠaljem(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Feed</Text>
            <Text style={styles.headerSubtitle}>Zagreb — što se događa</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logout}>Odjava</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); ucitajObjave(); }} colors={['#ef4444']} />}
      >
        {objave.length === 0 ? (
          <Text style={styles.prazno}>Još nema objava. Budi prvi!</Text>
        ) : (
          objave.map(o => (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.userBadge}>
                  <Ionicons name="person-circle-outline" size={14} color="#dc2626" />
                  <Text style={styles.usernameText}>{o.username}</Text>
                </View>
                {o.lokacija_naziv && (
                  <View style={styles.lokacijaWrap}>
                    <Ionicons name="location-outline" size={12} color="#6b7280" />
                    <Text style={styles.lokacija}>{o.lokacija_naziv}</Text>
                  </View>
                )}
                <Text style={styles.vrijeme}>{vremeProšlo(o.timestamp)}</Text>
              </View>
              <Text style={styles.tekst}>{o.tekst}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Što se događa u Zagrebu?"
            placeholderTextColor="#9ca3af"
            value={tekst}
            onChangeText={setTekst}
            maxLength={200}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!tekst.trim() || šaljem) && styles.sendBtnDisabled]}
            onPress={posaljiObjavu}
            disabled={!tekst.trim() || šaljem}
          >
            {šaljem
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="send" size={18} color="white" />
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.counter}>{tekst.length}/200</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#dc2626', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: '#fca5a5', fontSize: 13, marginTop: 2 },
  logout: { color: '#fca5a5', fontSize: 13 },
  list: { flex: 1, padding: 16 },
  prazno: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  usernameText: { fontWeight: '700', color: '#dc2626', fontSize: 13 },
  lokacijaWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  lokacija: { fontSize: 12, color: '#6b7280' },
  vrijeme: { fontSize: 12, color: '#9ca3af' },
  tekst: { fontSize: 15, color: '#111827', lineHeight: 22 },
  inputContainer: { backgroundColor: 'white', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, fontSize: 14, color: '#111827', maxHeight: 100 },
  sendBtn: { backgroundColor: '#dc2626', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#fca5a5' },
  sendBtnText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  counter: { fontSize: 11, color: '#d1d5db', marginTop: 4, textAlign: 'right' },
});