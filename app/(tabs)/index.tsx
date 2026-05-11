import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

type Lokacija = {
  id: number;
  naziv: string;
  kategorija: string;
  guzva: 'visoka' | 'umjerena' | 'niska';
  broj_prijava: number;
  lat: number;
  lng: number;
};

const API = 'http://10.100.200.134:3000';

const boje: Record<string, string> = {
  visoka: '#ef4444',
  umjerena: '#f97316',
  niska: '#22c55e',
};

const oznake: Record<string, string> = {
  visoka: 'Visoka gužva',
  umjerena: 'Umjerena gužva',
  niska: 'Niska gužva',
};

const kategorije = ['Sve', 'Financije', 'Pošta', 'Bolnica', 'Zdravstvo', 'Državna služba', 'Banka', 'Ljekarna', 'Promet', 'Trgovina'];

function udaljenost(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function HomeScreen() {
  const [lokacije, setLokacije] = useState<Lokacija[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [odabrana, setOdabrana] = useState<Lokacija | null>(null);
  const [filter, setFilter] = useState('Sve');
  const [pretraga, setPretraga] = useState('');

useEffect(() => {
  ucitajLokacije();
  const interval = setInterval(ucitajLokacije, 60000);
  return () => clearInterval(interval);
}, []);

  async function ucitajLokacije() {
    try {
      const res = await fetch(`${API}/api/lokacije`);
      const data = await res.json();
      setLokacije(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function prijaviGuzvu(guzva: string) {
    if (!odabrana) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Potrebna je lokacija za prijavu gužve.');
      return;
    }

    const pozicija = await Location.getCurrentPositionAsync({});
    const dist = udaljenost(
      pozicija.coords.latitude,
      pozicija.coords.longitude,
      odabrana.lat,
      odabrana.lng
    );

    if (dist > 300) {
      alert(`Predaleko si od lokacije. Moraš biti unutar 300m.\n\nTrenutna udaljenost: ${Math.round(dist)}m`);
      return;
    }

    await fetch(`${API}/api/lokacije`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: odabrana.id, guzva }),
    });
    setOdabrana(null);
    ucitajLokacije();
  }

  const filtrirane = lokacije
    .filter(l => filter === 'Sve' || l.kategorija === filter)
    .filter(l => l.naziv.toLowerCase().includes(pretraga.toLowerCase()));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>RED</Text>
        <Text style={styles.headerSubtitle}>Zagreb — gužva u realnom vremenu</Text>
        <TextInput
          style={styles.search}
          placeholder="Pretraži lokacije..."
          placeholderTextColor="#fca5a5"
          value={pretraga}
          onChangeText={setPretraga}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {kategorije.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.filterBtn, filter === k && styles.filterBtnActive]}
            onPress={() => setFilter(k)}
          >
            <Text style={[styles.filterBtnText, filter === k && styles.filterBtnTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); ucitajLokacije(); }} colors={['#ef4444']} />}
      >
        <Text style={styles.count}>{filtrirane.length} lokacija</Text>
        {filtrirane.map(lok => (
          <TouchableOpacity key={lok.id} style={styles.card} onPress={() => setOdabrana(lok)}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle}>{lok.naziv}</Text>
              <Text style={styles.cardKat}>{lok.kategorija}</Text>
              {lok.broj_prijava > 0 && (
                <Text style={styles.cardPrijave}>👥 {lok.broj_prijava} prijava</Text>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: boje[lok.guzva] }]}>
              <Text style={styles.badgeText}>{oznake[lok.guzva]}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!odabrana} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{odabrana?.naziv}</Text>
            <Text style={styles.modalSubtitle}>Prijavi trenutnu gužvu</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#22c55e' }]} onPress={() => prijaviGuzvu('niska')}>
              <Text style={styles.modalBtnText}>🟢 Nema gužve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f97316' }]} onPress={() => prijaviGuzvu('umjerena')}>
              <Text style={styles.modalBtnText}>🟠 Umjerena gužva</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={() => prijaviGuzvu('visoka')}>
              <Text style={styles.modalBtnText}>🔴 Visoka gužva</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOdabrana(null)}>
              <Text style={styles.modalOdustani}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#dc2626', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  headerSubtitle: { color: '#fca5a5', fontSize: 14, marginTop: 2 },
  search: { backgroundColor: '#b91c1c', color: 'white', borderRadius: 10, padding: 10, marginTop: 12, fontSize: 14 },
  filterScroll: { maxHeight: 50, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterContent: { paddingHorizontal: 12, alignItems: 'center', gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  filterBtnActive: { backgroundColor: '#dc2626' },
  filterBtnText: { fontSize: 13, color: '#6b7280' },
  filterBtnTextActive: { color: 'white', fontWeight: '600' },
  count: { fontSize: 13, color: '#9ca3af', marginBottom: 8 },
  list: { flex: 1, padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardKat: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  cardPrijave: { fontSize: 11, color: '#d1d5db', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#9ca3af', marginTop: 4, marginBottom: 20 },
  modalBtn: { padding: 16, borderRadius: 12, marginBottom: 10 },
  modalBtnText: { color: 'white', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  modalOdustani: { textAlign: 'center', color: '#9ca3af', marginTop: 8, padding: 8 },
});