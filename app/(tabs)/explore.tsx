import { StyleSheet, View, Modal, Text, TouchableOpacity, ActivityIndicator, TextInput, Keyboard } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
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

const piktogrami: Record<string, string> = {
  'Financije': '💳',
  'Pošta': '✉️',
  'Bolnica': '🏥',
  'Zdravstvo': '⚕️',
  'Državna služba': '🏛️',
  'Policija': '🚔',
  'Banka': '🏦',
  'Ljekarna': '💊',
  'Promet': '🚌',
  'Trgovina': '🛒',
};

function udaljenost(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function MapScreen() {
  const [lokacije, setLokacije] = useState<Lokacija[]>([]);
  const [odabrana, setOdabrana] = useState<Lokacija | null>(null);
  const [korisnikLok, setKorisnikLok] = useState<{latitude: number, longitude: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [pretraga, setPretraga] = useState('');
  const [pretragaAktivna, setPretragaAktivna] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    ucitajSve();
    const interval = setInterval(ucitajLokacije, 60000);
    return () => clearInterval(interval);
  }, []);

  async function ucitajSve() {
    await Promise.all([ucitajLokacije(), ucitajGPS()]);
    setLoading(false);
  }

  async function ucitajLokacije() {
    try {
      const res = await fetch(`${API}/api/lokacije`);
      const data = await res.json();
      setLokacije(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function ucitajGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    setKorisnikLok({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
  }

  function navigirajNaLokaciju(lok: Lokacija) {
    setPretraga('');
    setPretragaAktivna(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({
      latitude: lok.lat,
      longitude: lok.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 800);
    setTimeout(() => setOdabrana(lok), 900);
  }

  async function prijaviGuzvu(guzva: string) {
    if (!odabrana || !korisnikLok) return;

    const dist = udaljenost(
      korisnikLok.latitude,
      korisnikLok.longitude,
      odabrana.lat,
      odabrana.lng
    );

    if (dist > 300) {
      alert(`Predaleko si. Moraš biti unutar 300m.\n\nUdaljenost: ${Math.round(dist)}m`);
      return;
    }

    const res = await fetch(`${API}/api/lokacije`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: odabrana.id, guzva }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }

    setOdabrana(null);
    ucitajLokacije();
  }

  const rezultati = pretraga.length > 1
    ? lokacije.filter(l =>
        l.naziv.toLowerCase().includes(pretraga.toLowerCase()) ||
        l.kategorija.toLowerCase().includes(pretraga.toLowerCase())
      ).slice(0, 6)
    : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: korisnikLok?.latitude ?? 45.8150,
          longitude: korisnikLok?.longitude ?? 15.9819,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {lokacije.map(lok => (
          <Marker
            key={lok.id}
            coordinate={{ latitude: lok.lat, longitude: lok.lng }}
            tracksViewChanges={false}
            onPress={() => {
              setOdabrana(lok);
              setPretragaAktivna(false);
              mapRef.current?.animateToRegion({
                latitude: lok.lat,
                longitude: lok.lng,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }, 500);
            }}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerBubble, { backgroundColor: boje[lok.guzva] }]}>
                <Text style={styles.markerIcon}>{piktogrami[lok.kategorija] ?? '📍'}</Text>
              </View>
              <View style={[styles.markerTail, { borderTopColor: boje[lok.guzva] }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Traži lokaciju..."
            placeholderTextColor="#9ca3af"
            value={pretraga}
            onChangeText={setPretraga}
            onFocus={() => setPretragaAktivna(true)}
          />
          {pretraga.length > 0 && (
            <TouchableOpacity onPress={() => { setPretraga(''); setPretragaAktivna(false); }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {pretragaAktivna && rezultati.length > 0 && (
          <View style={styles.searchResults}>
            {rezultati.map(lok => (
              <TouchableOpacity
                key={lok.id}
                style={styles.searchResult}
                onPress={() => navigirajNaLokaciju(lok)}
              >
                <View style={[styles.searchDot, { backgroundColor: boje[lok.guzva] }]} />
                <View>
                  <Text style={styles.searchResultNaziv}>{lok.naziv}</Text>
                  <Text style={styles.searchResultKat}>{lok.kategorija}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal visible={!!odabrana} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{odabrana?.naziv}</Text>
            <Text style={styles.modalKat}>{odabrana?.kategorija}</Text>
            <View style={[styles.guzvaTag, { backgroundColor: boje[odabrana?.guzva ?? 'niska'] }]}>
              <Text style={styles.guzvaTagText}>{oznake[odabrana?.guzva ?? 'niska']}</Text>
            </View>
            {(odabrana?.broj_prijava ?? 0) > 0 && (
              <Text style={styles.prijaveText}>👥 {odabrana?.broj_prijava} prijava</Text>
            )}
            <Text style={styles.modalSubtitle}>Prijavi trenutnu gužvu</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#22c55e' }]} onPress={() => prijaviGuzvu('niska')}>
              <Text style={styles.modalBtnText}>Nema gužve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f97316' }]} onPress={() => prijaviGuzvu('umjerena')}>
              <Text style={styles.modalBtnText}>Umjerena gužva</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={() => prijaviGuzvu('visoka')}>
              <Text style={styles.modalBtnText}>Visoka gužva</Text>
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
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  markerContainer: { alignItems: 'center' },
  markerBubble: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  markerIcon: { fontSize: 18 },
  markerTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  searchContainer: { position: 'absolute', top: 60, left: 16, right: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  searchClear: { fontSize: 14, color: '#9ca3af', paddingLeft: 8 },
  searchResults: { backgroundColor: 'white', borderRadius: 14, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, overflow: 'hidden' },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  searchDot: { width: 10, height: 10, borderRadius: 5 },
  searchResultNaziv: { fontSize: 14, fontWeight: '600', color: '#111827' },
  searchResultKat: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalKat: { fontSize: 14, color: '#9ca3af', marginTop: 2 },
  guzvaTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  guzvaTagText: { color: 'white', fontSize: 13, fontWeight: '600' },
  prijaveText: { fontSize: 13, color: '#9ca3af', marginTop: 6 },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 16, marginBottom: 12 },
  modalBtn: { padding: 16, borderRadius: 12, marginBottom: 10 },
  modalBtnText: { color: 'white', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  modalOdustani: { textAlign: 'center', color: '#9ca3af', marginTop: 4, padding: 8 },
});