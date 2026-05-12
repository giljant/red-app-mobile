import { StyleSheet, View, Modal, Text, TouchableOpacity, ActivityIndicator, TextInput, Keyboard, ScrollView, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState, useEffect, useRef } from 'react';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT, LongPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { jeOtvoreno, formatRadnoVrijeme, okvirnoČekanje } from '../../utils/radnoVrijeme';
import { useUser } from '../context/user';

const TOMTOM_KEY = 'KaX6ONmXiBd1STYBZrpzme07i1JUBzAb';
const API = 'http://10.100.200.134:3000';

type Lokacija = {
  id: number;
  naziv: string;
  kategorija: string;
  guzva: 'visoka' | 'umjerena' | 'niska';
  broj_prijava: number;
  lat: number;
  lng: number;
  pon_pet: string | null;
  subota: string | null;
  nedjelja: string | null;
};

type Incident = {
  id: number;
  tip: 'guzva' | 'nesreca' | 'radovi' | 'zatvoreno';
  opis: string | null;
  lat: number;
  lng: number;
  username: string;
  timestamp: string;
};

const INCIDENT_TIPOVI: { tip: Incident['tip']; ikona: IoniconsName; naziv: string; boja: string }[] = [
  { tip: 'guzva',     ikona: 'car-outline',          naziv: 'Gužva',     boja: '#f97316' },
  { tip: 'nesreca',   ikona: 'warning-outline',       naziv: 'Nesreća',   boja: '#ef4444' },
  { tip: 'radovi',    ikona: 'construct-outline',     naziv: 'Radovi',    boja: '#eab308' },
  { tip: 'zatvoreno', ikona: 'ban-outline',           naziv: 'Zatvoreno', boja: '#6b7280' },
];

const boje: Record<string, string> = {
  visoka: '#ef4444', umjerena: '#f97316', niska: '#22c55e',
};
const oznake: Record<string, string> = {
  visoka: 'Visoka gužva', umjerena: 'Umjerena gužva', niska: 'Niska gužva',
};
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ikone: Record<string, IoniconsName> = {
  'Sve':            'apps-outline',
  'Financije':      'card-outline',
  'Pošta':          'mail-outline',
  'Bolnica':        'medkit-outline',
  'Zdravstvo':      'fitness-outline',
  'Državna služba': 'business-outline',
  'Policija':       'shield-outline',
  'Banka':          'wallet-outline',
  'Ljekarna':       'bandage-outline',
  'Promet':         'bus-outline',
  'Trgovina':       'bag-handle-outline',
};

function vremeProšlo(ts: string) {
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return 'upravo';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h`;
}

function udaljenost(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const KATEGORIJE_FILTER = ['Sve', 'Financije', 'Pošta', 'Bolnica', 'Zdravstvo', 'Državna služba', 'Banka', 'Ljekarna', 'Promet', 'Trgovina', 'Policija'];

export default function MapScreen() {
  const [lokacije, setLokacije] = useState<Lokacija[]>([]);
  const [incidenti, setIncidenti] = useState<Incident[]>([]);
  const [odabrana, setOdabrana] = useState<Lokacija | null>(null);
  const [korisnikLok, setKorisnikLok] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pretraga, setPretraga] = useState('');
  const [pretragaAktivna, setPretragaAktivna] = useState(false);
  const [trafficOn, setTrafficOn] = useState(true);
  const [noviIncident, setNoviIncident] = useState<{ lat: number; lng: number } | null>(null);
  const [odabraniTip, setOdabraniTip] = useState<Incident['tip'] | null>(null);
  const [opisIncidenta, setOpisIncidenta] = useState('');
  const [odabraniIncident, setOdabraniIncident] = useState<Incident | null>(null);
  const [filterKat, setFilterKat] = useState('Sve');
  const mapRef = useRef<MapView>(null);
  const { username } = useUser();

  useEffect(() => {
    ucitajSve();
    const interval = setInterval(() => { ucitajLokacije(); ucitajIncidente(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function ucitajSve() {
    await Promise.all([ucitajLokacije(), ucitajGPS(), ucitajIncidente()]);
    setLoading(false);
  }

  async function ucitajLokacije() {
    try {
      const res = await fetch(`${API}/api/lokacije`);
      setLokacije(await res.json());
    } catch (e) {}
  }

  async function ucitajIncidente() {
    try {
      const res = await fetch(`${API}/api/incidenti`);
      setIncidenti(await res.json());
    } catch (e) {}
  }

  async function ucitajGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    setKorisnikLok({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
  }

  function navigirajNaLokaciju(lok: Lokacija) {
    setPretraga(''); setPretragaAktivna(false); Keyboard.dismiss();
    mapRef.current?.animateToRegion({ latitude: lok.lat, longitude: lok.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
    setTimeout(() => setOdabrana(lok), 900);
  }

  async function prijaviGuzvu(guzva: string) {
    if (!odabrana || !korisnikLok) return;
    const dist = udaljenost(korisnikLok.latitude, korisnikLok.longitude, odabrana.lat, odabrana.lng);
    if (dist > 300) { alert(`Predaleko si. Moraš biti unutar 300m.\n\nUdaljenost: ${Math.round(dist)}m`); return; }
    const res = await fetch(`${API}/api/lokacije`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: odabrana.id, guzva }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setOdabrana(null);
    ucitajLokacije();
  }

  function onLongPress(e: LongPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setNoviIncident({ lat: latitude, lng: longitude });
    setOdabraniTip(null);
    setOpisIncidenta('');
  }

  async function posaljiIncident() {
    if (!noviIncident || !odabraniTip) return;
    await fetch(`${API}/api/incidenti`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tip: odabraniTip,
        opis: opisIncidenta.trim() || null,
        lat: noviIncident.lat,
        lng: noviIncident.lng,
        username: username ?? 'Anonimno',
      }),
    });
    setNoviIncident(null);
    ucitajIncidente();
  }

  const prikazaneLokacije = filterKat === 'Sve' ? lokacije : lokacije.filter(l => l.kategorija === filterKat);

  const rezultati = pretraga.length > 1
    ? lokacije.filter(l => l.naziv.toLowerCase().includes(pretraga.toLowerCase()) || l.kategorija.toLowerCase().includes(pretraga.toLowerCase())).slice(0, 6)
    : [];

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#ef4444" /></View>;
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
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
        onLongPress={onLongPress}
        onPress={() => { setPretragaAktivna(false); Keyboard.dismiss(); }}
      >
        {trafficOn && (
          <UrlTile
            urlTemplate={`https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256&thickness=2`}
            maximumZ={19}
            flipY={false}
            opacity={1}
            zIndex={1}
          />
        )}

        {filterKat !== 'Sve' && prikazaneLokacije.map(lok => (
          <Marker
            key={`cat-${lok.id}`}
            coordinate={{ latitude: lok.lat, longitude: lok.lng }}
            tracksViewChanges={false}
            zIndex={5}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => {
              setOdabrana(lok);
              setPretragaAktivna(false);
              mapRef.current?.animateToRegion({ latitude: lok.lat, longitude: lok.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
            }}
          >
            <View style={[styles.categoryMarker, { backgroundColor: boje[lok.guzva] }]}>
              <Ionicons name={ikone[lok.kategorija] ?? 'location-outline'} size={14} color="white" />
            </View>
          </Marker>
        ))}

        {incidenti.map(inc => {
          const t = INCIDENT_TIPOVI.find(t => t.tip === inc.tip)!;
          return (
            <Marker
              key={`inc-${inc.id}`}
              coordinate={{ latitude: inc.lat, longitude: inc.lng }}
              tracksViewChanges={false}
              zIndex={4}
              onPress={() => setOdabraniIncident(inc)}
            >
              <View style={[styles.incidentDot, { backgroundColor: t.boja }]}>
                <Ionicons name={t.ikona} size={14} color="white" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Search + filter chips */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
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
              <Ionicons name="close-outline" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {pretragaAktivna && rezultati.length > 0 ? (
          <View style={styles.searchResults}>
            {rezultati.map(lok => (
              <TouchableOpacity key={lok.id} style={styles.searchResult} onPress={() => navigirajNaLokaciju(lok)}>
                <View style={[styles.searchDot, { backgroundColor: boje[lok.guzva] }]} />
                <View>
                  <Text style={styles.searchResultNaziv}>{lok.naziv}</Text>
                  <Text style={styles.searchResultKat}>{lok.kategorija}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : !pretragaAktivna && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
            contentContainerStyle={styles.filterContent}
            keyboardShouldPersistTaps="handled"
          >
            {KATEGORIJE_FILTER.map(k => (
              <TouchableOpacity
                key={k}
                style={[styles.filterChip, filterKat === k && styles.filterChipActive]}
                onPress={() => setFilterKat(k)}
              >
                {k !== 'Sve' && (
                  <Ionicons
                    name={ikone[k] ?? 'location-outline'}
                    size={12}
                    color={filterKat === k ? 'white' : '#6b7280'}
                  />
                )}
                <Text style={[styles.filterChipText, filterKat === k && styles.filterChipTextActive]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Traffic toggle */}
      <TouchableOpacity style={[styles.trafficBtn, trafficOn && styles.trafficBtnOn]} onPress={() => setTrafficOn(v => !v)}>
        <Ionicons name="speedometer-outline" size={18} color={trafficOn ? 'white' : '#374151'} />
      </TouchableOpacity>


      {/* Modal — lokacija */}
      <Modal visible={!!odabrana} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{odabrana?.naziv}</Text>
            <Text style={styles.modalKat}>{odabrana?.kategorija}</Text>
            <View style={styles.modalTagRow}>
              <View style={[styles.guzvaTag, { backgroundColor: boje[odabrana?.guzva ?? 'niska'] }]}>
                <Text style={styles.guzvaTagText}>{oznake[odabrana?.guzva ?? 'niska']}</Text>
              </View>
              {odabrana && (
                <View style={[styles.statusTag, { backgroundColor: jeOtvoreno(odabrana) ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={[styles.statusTagText, { color: jeOtvoreno(odabrana) ? '#16a34a' : '#dc2626' }]}>
                    {jeOtvoreno(odabrana) ? '● Otvoreno' : '● Zatvoreno'}
                  </Text>
                </View>
              )}
              {odabrana && (
                <View style={[styles.čekanjeTag, { backgroundColor: boje[odabrana.guzva] + '18' }]}>
                  <Ionicons name="time-outline" size={13} color={boje[odabrana.guzva]} />
                  <Text style={[styles.čekanjeTagText, { color: boje[odabrana.guzva] }]}>
                    {okvirnoČekanje(odabrana.guzva, odabrana.kategorija)}
                  </Text>
                </View>
              )}
            </View>
            {odabrana && <Text style={styles.radnoVrijemeText}>{formatRadnoVrijeme(odabrana)}</Text>}
            {(odabrana?.broj_prijava ?? 0) > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="people-outline" size={13} color="#9ca3af" />
                <Text style={styles.prijaveText}>{odabrana?.broj_prijava} prijava</Text>
              </View>
            )}
            <Text style={styles.modalSubtitle}>Prijavi trenutnu gužvu</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#22c55e' }]} onPress={() => prijaviGuzvu('niska')}>
              <View style={styles.modalBtnInner}>
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.modalBtnText}>Nema gužve</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f97316' }]} onPress={() => prijaviGuzvu('umjerena')}>
              <View style={styles.modalBtnInner}>
                <Ionicons name="alert-circle-outline" size={18} color="white" />
                <Text style={styles.modalBtnText}>Umjerena gužva</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={() => prijaviGuzvu('visoka')}>
              <View style={styles.modalBtnInner}>
                <Ionicons name="warning-outline" size={18} color="white" />
                <Text style={styles.modalBtnText}>Visoka gužva</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOdabrana(null)}>
              <Text style={styles.modalOdustani}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal — novi incident */}
      <Modal visible={!!noviIncident} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Prijavi incident</Text>
            <Text style={styles.modalKat}>Što se događa na ovoj lokaciji?</Text>
            <View style={styles.tipGrid}>
              {INCIDENT_TIPOVI.map(t => (
                <TouchableOpacity
                  key={t.tip}
                  style={[styles.tipBtn, odabraniTip === t.tip && { backgroundColor: t.boja }]}
                  onPress={() => setOdabraniTip(t.tip)}
                >
                  <Ionicons name={t.ikona} size={24} color={odabraniTip === t.tip ? 'white' : '#374151'} />
                  <Text style={[styles.tipNaziv, odabraniTip === t.tip && { color: 'white' }]}>{t.naziv}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.opisInput}
              placeholder="Opis (opcionalno)..."
              placeholderTextColor="#9ca3af"
              value={opisIncidenta}
              onChangeText={setOpisIncidenta}
              maxLength={100}
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: odabraniTip ? '#dc2626' : '#e5e7eb' }]}
              onPress={posaljiIncident}
              disabled={!odabraniTip}
            >
              <Text style={[styles.modalBtnText, !odabraniTip && { color: '#9ca3af' }]}>Prijavi</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNoviIncident(null)}>
              <Text style={styles.modalOdustani}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal — detalji incidenta */}
      <Modal visible={!!odabraniIncident} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            {odabraniIncident && (() => {
              const t = INCIDENT_TIPOVI.find(t => t.tip === odabraniIncident.tip)!;
              return (
                <>
                  <View style={styles.incidentDetailHeader}>
                    <View style={[styles.incidentDetailIcon, { backgroundColor: t.boja }]}>
                      <Ionicons name={t.ikona} size={24} color="white" />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>{t.naziv}</Text>
                      <Text style={styles.modalKat}>Prijavio: {odabraniIncident.username} · {vremeProšlo(odabraniIncident.timestamp)}</Text>
                    </View>
                  </View>
                  {odabraniIncident.opis && <Text style={styles.incidentOpis}>{odabraniIncident.opis}</Text>}
                  <Text style={styles.incidentExpiry}>Incident se automatski briše nakon 2 sata</Text>
                </>
              );
            })()}
            <TouchableOpacity onPress={() => setOdabraniIncident(null)}>
              <Text style={styles.modalOdustani}>Zatvori</Text>
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
  // Alert markers (visoka gužva only)
  incidentDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  categoryMarker: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 6 },
  // Search
  searchContainer: { position: 'absolute', top: 56, left: 14, right: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  searchClear: { fontSize: 13, color: '#9ca3af', paddingLeft: 8 },
  searchResults: { backgroundColor: 'white', borderRadius: 12, marginTop: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, overflow: 'hidden' },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10 },
  searchDot: { width: 8, height: 8, borderRadius: 4 },
  searchResultNaziv: { fontSize: 14, fontWeight: '600', color: '#111827' },
  searchResultKat: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  // Traffic toggle
  trafficBtn: { position: 'absolute', top: 164, right: 14, width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  trafficBtnOn: { backgroundColor: '#dc2626' },
  trafficBtnIcon: { fontSize: 18 },
  // Category filter
  filterContent: { paddingHorizontal: 4, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
  filterChipActive: { backgroundColor: '#dc2626' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: 'white' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalKat: { fontSize: 14, color: '#9ca3af', marginTop: 2 },
  modalTagRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  guzvaTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  guzvaTagText: { color: 'white', fontSize: 13, fontWeight: '600' },
  statusTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusTagText: { fontSize: 13, fontWeight: '600' },
  čekanjeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  čekanjeTagText: { fontSize: 13, fontWeight: '700' },
  radnoVrijemeText: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  prijaveText: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 16, marginBottom: 12 },
  modalBtn: { padding: 16, borderRadius: 12, marginBottom: 10 },
  modalBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalBtnText: { color: 'white', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  modalOdustani: { textAlign: 'center', color: '#9ca3af', marginTop: 4, padding: 8 },
  tipGrid: { flexDirection: 'row', gap: 10, marginVertical: 16, flexWrap: 'wrap' },
  tipBtn: { flex: 1, minWidth: '40%', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#f3f4f6', gap: 4 },
  tipNaziv: { fontSize: 13, fontWeight: '600', color: '#374151' },
  opisInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', marginBottom: 12 },
  incidentDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  incidentDetailIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  incidentOpis: { fontSize: 15, color: '#374151', marginBottom: 8 },
  incidentExpiry: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
});
