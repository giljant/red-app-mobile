import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { jeOtvoreno, formatRadnoVrijeme, okvirnoČekanje, svjezinaStatusa, svjezinaLabel } from '../../utils/radnoVrijeme';
import { useUser } from '../context/user';

type Lokacija = {
  id: number;
  naziv: string;
  kategorija: string;
  guzva: 'visoka' | 'umjerena' | 'niska';
  guzva_prosjecna: string | null;
  broj_prijava: number;
  last_updated: string | null;
  lat: number;
  lng: number;
  pon_pet: string | null;
  subota: string | null;
  nedjelja: string | null;
};

const API = 'http://10.100.200.134:3000';

const boje: Record<string, string> = {
  visoka: '#ef4444', umjerena: '#f97316', niska: '#22c55e',
};

const ikone: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
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

const kategorije = ['Sve', 'Financije', 'Pošta', 'Bolnica', 'Zdravstvo', 'Državna služba', 'Banka', 'Ljekarna', 'Promet', 'Trgovina', 'Policija'];

function udaljenost(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatUdaljenost(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

export default function HomeScreen() {
  const [lokacije, setLokacije] = useState<Lokacija[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [odabrana, setOdabrana] = useState<Lokacija | null>(null);
  const [filter, setFilter] = useState('Sve');
  const [gpsLok, setGpsLok] = useState<{ lat: number; lng: number } | null>(null);
  const { deviceId } = useUser();
  const router = useRouter();

  useEffect(() => {
    ucitajLokacije();
    ucitajGPS();
    const interval = setInterval(ucitajLokacije, 60000);
    return () => clearInterval(interval);
  }, []);

  async function ucitajLokacije() {
    try {
      const res = await fetch(`${API}/api/lokacije`);
      setLokacije(await res.json());
    } catch (e) {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function ucitajGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    setGpsLok({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  async function prijaviGuzvu(guzva: string) {
    if (!odabrana) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { alert('Potrebna je lokacija za prijavu gužve.'); return; }
    const pos = await Location.getCurrentPositionAsync({});
    const dist = udaljenost(pos.coords.latitude, pos.coords.longitude, odabrana.lat, odabrana.lng);
    if (dist > 300) { alert(`Predaleko si. Moraš biti unutar 300m.\n\nUdaljenost: ${Math.round(dist)}m`); return; }
    const res = await fetch(`${API}/api/lokacije`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: odabrana.id, guzva, device_id: deviceId }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setOdabrana(null);
    ucitajLokacije();
  }

  function otvoriKadaIci(lok: Lokacija) {
    setOdabrana(null);
    router.push({
      pathname: '/lokacija/[id]',
      params: {
        id: String(lok.id),
        naziv: lok.naziv,
        kategorija: lok.kategorija,
        pon_pet: lok.pon_pet ?? '',
        subota: lok.subota ?? '',
        nedjelja: lok.nedjelja ?? '',
      },
    });
  }

  const blizuMene = gpsLok
    ? [...lokacije]
        .map(l => ({ ...l, dist: udaljenost(gpsLok.lat, gpsLok.lng, l.lat, l.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 6)
    : [];

  const filtrirane = lokacije.filter(l => filter === 'Sve' || l.kategorija === filter);
  const visoka = filtrirane.filter(l => l.guzva === 'visoka');
  const ostale = filtrirane.filter(l => l.guzva !== 'visoka');

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#ef4444" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Zagreb</Text>
        <Text style={styles.headerSubtitle}>Gužva u realnom vremenu</Text>
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        {kategorije.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.filterChip, filter === k && styles.filterChipActive]}
            onPress={() => setFilter(k)}
          >
            {k !== 'Sve' && <Ionicons name={ikone[k] ?? 'location-outline'} size={12} color={filter === k ? 'white' : '#6b7280'} />}
            <Text style={[styles.filterChipText, filter === k && styles.filterChipTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); ucitajLokacije(); }} colors={['#ef4444']} />}
      >
        {/* Blizu mene */}
        {blizuMene.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="navigate-outline" size={14} color="#6b7280" />
              <Text style={styles.sectionTitle}>Blizu tebe</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
              {blizuMene.map((lok: any) => {
                const svježe = svjezinaStatusa(lok.last_updated);
                const guzvaZaPrikaz = svježe === 'nepoznato' && lok.guzva_prosjecna ? lok.guzva_prosjecna : lok.guzva;
                return (
                  <TouchableOpacity key={lok.id} style={styles.blizuCard} onPress={() => setOdabrana(lok)}>
                    <View style={[styles.blizuIkona, { backgroundColor: boje[guzvaZaPrikaz] + '18' }]}>
                      <Ionicons name={ikone[lok.kategorija] ?? 'location-outline'} size={18} color={boje[guzvaZaPrikaz]} />
                    </View>
                    <Text style={styles.blizuNaziv} numberOfLines={2}>{lok.naziv}</Text>
                    {svježe === 'nepoznato' && (
                      <Text style={styles.blizuNepoznato}>Uobičajeno</Text>
                    )}
                    <View style={styles.blizuBottom}>
                      <Text style={styles.blizuDist}>{formatUdaljenost(lok.dist)}</Text>
                      <Text style={[styles.blizuČekanje, { color: boje[guzvaZaPrikaz] }]}>
                        {okvirnoČekanje(guzvaZaPrikaz as any, lok.kategorija)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Visoka gužva */}
        {visoka.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={14} color="#ef4444" />
              <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Visoka gužva</Text>
            </View>
            {visoka.map(lok => <LokacijaCard key={lok.id} lok={lok} onPress={() => setOdabrana(lok)} gpsLok={gpsLok} />)}
          </View>
        )}

        {/* Sve ostale */}
        <View style={styles.section}>
          {visoka.length > 0 && (
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={14} color="#6b7280" />
              <Text style={styles.sectionTitle}>Sve lokacije</Text>
            </View>
          )}
          {ostale.map(lok => <LokacijaCard key={lok.id} lok={lok} onPress={() => setOdabrana(lok)} gpsLok={gpsLok} />)}
        </View>
      </ScrollView>

      <Modal visible={!!odabrana} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            {odabrana && (() => {
              const svježe = svjezinaStatusa(odabrana.last_updated);
              const guzvaZaPrikaz = svježe === 'nepoznato' && odabrana.guzva_prosjecna
                ? odabrana.guzva_prosjecna as 'visoka' | 'umjerena' | 'niska'
                : odabrana.guzva;
              return (
                <>
                  <View style={styles.modalTop}>
                    <View style={[styles.modalIkona, { backgroundColor: boje[guzvaZaPrikaz] + '18' }]}>
                      <Ionicons name={ikone[odabrana.kategorija] ?? 'location-outline'} size={22} color={boje[guzvaZaPrikaz]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{odabrana.naziv}</Text>
                      <Text style={styles.modalKat}>{odabrana.kategorija}</Text>
                    </View>
                  </View>

                  <View style={styles.modalInfo}>
                    <Text style={[styles.modalStatus, { color: jeOtvoreno(odabrana) ? '#16a34a' : '#dc2626' }]}>
                      {jeOtvoreno(odabrana) ? '● Otvoreno' : '● Zatvoreno'}
                    </Text>
                    <Text style={styles.modalRV}>{formatRadnoVrijeme(odabrana)}</Text>
                    <View style={styles.modalČekanjeWrap}>
                      <Ionicons name="time-outline" size={13} color={boje[guzvaZaPrikaz]} />
                      <Text style={[styles.modalČekanje, { color: boje[guzvaZaPrikaz] }]}>
                        {okvirnoČekanje(guzvaZaPrikaz, odabrana.kategorija)}
                      </Text>
                    </View>
                    {svježe === 'nepoznato' ? (
                      <View style={styles.svjezinaWrap}>
                        <Ionicons name="time-outline" size={11} color="#9ca3af" />
                        <Text style={styles.svjezinaNepoznato}>Uobičajeno</Text>
                      </View>
                    ) : svježe === 'staro' ? (
                      <View style={styles.svjezinaWrap}>
                        <Ionicons name="time-outline" size={11} color="#f97316" />
                        <Text style={styles.svjezinaStaro}>{svjezinaLabel(odabrana.last_updated)} staro</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => otvoriKadaIci(odabrana)}>
                      <Ionicons name="calendar-outline" size={16} color="#dc2626" />
                      <Text style={styles.actionBtnText}>Kada ići</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSubtitle}>Prijavi trenutnu gužvu</Text>
                  {[
                    { guzva: 'niska', boja: '#22c55e', ikona: 'checkmark-circle-outline' as const, label: 'Nema gužve' },
                    { guzva: 'umjerena', boja: '#f97316', ikona: 'alert-circle-outline' as const, label: 'Umjerena gužva' },
                    { guzva: 'visoka', boja: '#ef4444', ikona: 'warning-outline' as const, label: 'Visoka gužva' },
                  ].map(({ guzva, boja, ikona, label }) => (
                    <TouchableOpacity key={guzva} style={[styles.modalBtn, { backgroundColor: boja }]} onPress={() => prijaviGuzvu(guzva)}>
                      <View style={styles.modalBtnInner}>
                        <Ionicons name={ikona} size={18} color="white" />
                        <Text style={styles.modalBtnText}>{label}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setOdabrana(null)}>
                    <Text style={styles.modalOdustani}>Odustani</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LokacijaCard({ lok, onPress, gpsLok }: { lok: Lokacija; onPress: () => void; gpsLok: { lat: number; lng: number } | null }) {
  const dist = gpsLok ? udaljenost(gpsLok.lat, gpsLok.lng, lok.lat, lok.lng) : null;
  const svježe = svjezinaStatusa(lok.last_updated);
  const guzvaZaPrikaz = svježe === 'nepoznato' && lok.guzva_prosjecna
    ? lok.guzva_prosjecna as 'visoka' | 'umjerena' | 'niska'
    : lok.guzva;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.cardIkona, { backgroundColor: boje[guzvaZaPrikaz] + '15' }]}>
        <Ionicons name={ikone[lok.kategorija] ?? 'location-outline'} size={18} color={boje[guzvaZaPrikaz]} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{lok.naziv}</Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardStatus, { color: jeOtvoreno(lok) ? '#16a34a' : '#9ca3af' }]}>
            {jeOtvoreno(lok) ? 'Otvoreno' : 'Zatvoreno'}
          </Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardKat}>{lok.kategorija}</Text>
          {dist !== null && (
            <>
              <Text style={styles.cardDot}>·</Text>
              <Text style={styles.cardDist}>{formatUdaljenost(dist)}</Text>
            </>
          )}
          <Text style={styles.cardDot}>·</Text>
          <Ionicons name="time-outline" size={11} color={boje[guzvaZaPrikaz]} />
          <Text style={[styles.cardČekanje, { color: boje[guzvaZaPrikaz] }]}>
            {svježe === 'nepoznato' ? 'Uobičajeno' : okvirnoČekanje(guzvaZaPrikaz, lok.kategorija)}
          </Text>
        </View>
      </View>
      <View style={[styles.guzvaBar, { backgroundColor: boje[guzvaZaPrikaz], opacity: svježe === 'nepoznato' ? 0.35 : 1 }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#dc2626', paddingTop: 58, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', letterSpacing: -0.5 },
  headerSubtitle: { color: '#fca5a5', fontSize: 13, marginTop: 1 },
  filterScroll: { maxHeight: 48, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterContent: { paddingHorizontal: 14, alignItems: 'center', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  filterChipActive: { backgroundColor: '#dc2626' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: 'white' },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  blizuCard: { width: 120, backgroundColor: 'white', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  blizuIkona: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  blizuNaziv: { fontSize: 12, fontWeight: '600', color: '#111827', lineHeight: 16, flex: 1 },
  blizuNepoznato: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  blizuBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  blizuDist: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  blizuČekanje: { fontSize: 11, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, gap: 12 },
  cardIkona: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cardStatus: { fontSize: 12, fontWeight: '500' },
  cardDot: { fontSize: 12, color: '#d1d5db' },
  cardKat: { fontSize: 12, color: '#9ca3af' },
  cardDist: { fontSize: 12, color: '#9ca3af' },
  cardČekanje: { fontSize: 12, fontWeight: '600' },
  guzvaBar: { width: 4, height: 36, borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  modalIkona: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  modalKat: { fontSize: 13, color: '#9ca3af', marginTop: 1 },
  modalInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  modalStatus: { fontSize: 13, fontWeight: '600' },
  modalRV: { fontSize: 13, color: '#6b7280' },
  modalČekanjeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalČekanje: { fontSize: 13, fontWeight: '700' },
  svjezinaWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  svjezinaNepoznato: { fontSize: 11, color: '#9ca3af' },
  svjezinaStaro: { fontSize: 11, color: '#f97316' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#dc2626', borderRadius: 10, paddingVertical: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  modalSubtitle: { fontSize: 13, color: '#9ca3af', marginBottom: 12 },
  modalBtn: { padding: 15, borderRadius: 12, marginBottom: 8 },
  modalBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalBtnText: { color: 'white', fontWeight: '600', fontSize: 15 },
  modalOdustani: { textAlign: 'center', color: '#9ca3af', padding: 10 },
});
