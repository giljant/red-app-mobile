import { StyleSheet, View, Modal, Text, TouchableOpacity, ActivityIndicator, TextInput, Keyboard, ScrollView, Platform, UIManager } from 'react-native';
import { useState, useEffect, useRef } from 'react';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT, LongPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { jeOtvoreno, formatRadnoVrijeme, okvirnoČekanje, svjezinaStatusa, svjezinaLabel } from '../../utils/radnoVrijeme';
import { useUser } from '../context/user';

const TOMTOM_KEY = 'KaX6ONmXiBd1STYBZrpzme07i1JUBzAb';
const API = 'http://10.100.200.134:3000';

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

type Incident = {
  id: number;
  tip: 'guzva' | 'nesreca' | 'radovi' | 'zatvoreno';
  opis: string | null;
  lat: number;
  lng: number;
  username: string;
  timestamp: string;
};

type RutaInfo = {
  distancaMetri: number;
  vrijemeSeconds: number;
  lokacija: Lokacija;
};

const INCIDENT_TIPOVI: { tip: Incident['tip']; ikona: IoniconsName; naziv: string; boja: string }[] = [
  { tip: 'guzva',     ikona: 'car-outline',      naziv: 'Gužva',     boja: '#f97316' },
  { tip: 'nesreca',   ikona: 'warning-outline',   naziv: 'Nesreća',   boja: '#ef4444' },
  { tip: 'radovi',    ikona: 'construct-outline', naziv: 'Radovi',    boja: '#eab308' },
  { tip: 'zatvoreno', ikona: 'ban-outline',       naziv: 'Zatvoreno', boja: '#6b7280' },
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

function formatDistanca(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatETA(sec: number): string {
  const min = Math.round(sec / 60);
  return min < 1 ? '< 1 min' : `${min} min`;
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
  const [ruta, setRuta] = useState<{ latitude: number; longitude: number }[] | null>(null);
  const [rutaInfo, setRutaInfo] = useState<RutaInfo | null>(null);
  const [rutaLoading, setRutaLoading] = useState(false);
  const [prijaviMod, setPrijaviMod] = useState(false);
  const mapRef = useRef<MapView>(null);
  const { username, deviceId } = useUser();
  const router = useRouter();

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

  async function fetchRuta(lok: Lokacija) {
    if (!korisnikLok) return;
    setRutaLoading(true);
    obrišiRutu();
    try {
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${korisnikLok.latitude},${korisnikLok.longitude}:${lok.lat},${lok.lng}/json?key=${TOMTOM_KEY}&travelMode=car&traffic=true&routeType=fastest`;
      const res = await fetch(url);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;
      const points: { latitude: number; longitude: number }[] = route.legs[0].points.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));
      setRuta(points);
      setRutaInfo({
        distancaMetri: route.summary.lengthInMeters,
        vrijemeSeconds: route.summary.travelTimeInSeconds,
        lokacija: lok,
      });
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 160, right: 40, bottom: 140, left: 40 },
        animated: true,
      });
    } catch (e) {}
    finally {
      setRutaLoading(false);
    }
  }

  function obrišiRutu() {
    setRuta(null);
    setRutaInfo(null);
  }

  function navigirajNaLokaciju(lok: Lokacija) {
    setPretraga(''); setPretragaAktivna(false); Keyboard.dismiss();
    fetchRuta(lok);
    setTimeout(() => setOdabrana(lok), 400);
  }

  async function prijaviGuzvu(guzva: string) {
    if (!odabrana || !korisnikLok) return;
    const dist = udaljenost(korisnikLok.latitude, korisnikLok.longitude, odabrana.lat, odabrana.lng);
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

        {ruta && rutaInfo && (
          <Polyline
            coordinates={ruta}
            strokeColor={boje[rutaInfo.lokacija.guzva]}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={3}
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultNaziv}>{lok.naziv}</Text>
                  <Text style={styles.searchResultKat}>{lok.kategorija} · {okvirnoČekanje(lok.guzva, lok.kategorija)}</Text>
                </View>
                <Ionicons name="navigate-outline" size={14} color="#9ca3af" />
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

      {/* ETA bar — prikazuje se dok je ruta aktivna */}
      {rutaInfo && !odabrana && (
        <View style={[styles.etaBar, { borderLeftColor: boje[rutaInfo.lokacija.guzva] }]}>
          <View style={[styles.etaIcon, { backgroundColor: boje[rutaInfo.lokacija.guzva] }]}>
            <Ionicons name="navigate" size={14} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.etaNaziv} numberOfLines={1}>{rutaInfo.lokacija.naziv}</Text>
            <Text style={styles.etaDetalji}>
              {formatDistanca(rutaInfo.distancaMetri)} · {formatETA(rutaInfo.vrijemeSeconds)} · {okvirnoČekanje(rutaInfo.lokacija.guzva, rutaInfo.lokacija.kategorija)} čekanja
            </Text>
          </View>
          {rutaLoading
            ? <ActivityIndicator size="small" color="#9ca3af" />
            : <TouchableOpacity onPress={obrišiRutu} style={styles.etaClose}>
                <Ionicons name="close" size={18} color="#9ca3af" />
              </TouchableOpacity>
          }
        </View>
      )}

      {rutaLoading && !rutaInfo && (
        <View style={styles.etaBar}>
          <ActivityIndicator size="small" color="#ef4444" style={{ marginRight: 10 }} />
          <Text style={styles.etaNaziv}>Učitavanje rute...</Text>
        </View>
      )}

      {/* Modal — lokacija */}
      <Modal visible={!!odabrana} transparent animationType="slide" onDismiss={() => setPrijaviMod(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setOdabrana(null); setPrijaviMod(false); }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modal}>
              <View style={styles.modalHandle} />

              {/* Header: ikona + naziv + kategorija */}
              <View style={styles.modalHeader}>
                <View style={[styles.modalIkona, { backgroundColor: boje[odabrana?.guzva ?? 'niska'] + '1a' }]}>
                  <Ionicons name={ikone[odabrana?.kategorija ?? ''] ?? 'location-outline'} size={22} color={boje[odabrana?.guzva ?? 'niska']} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{odabrana?.naziv}</Text>
                  <Text style={styles.modalKat}>{odabrana?.kategorija}</Text>
                </View>
              </View>

              {/* Statusna linija */}
              {odabrana && (() => {
                const svježe = svjezinaStatusa(odabrana.last_updated);
                const guzvaZaPrikaz = svježe === 'nepoznato' && odabrana.guzva_prosjecna
                  ? odabrana.guzva_prosjecna as 'visoka' | 'umjerena' | 'niska'
                  : odabrana.guzva;
                return (
                  <>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: jeOtvoreno(odabrana) ? '#22c55e' : '#ef4444' }]} />
                      <Text style={[styles.statusTekst, { color: jeOtvoreno(odabrana) ? '#16a34a' : '#ef4444' }]}>
                        {jeOtvoreno(odabrana) ? 'Otvoreno' : 'Zatvoreno'}
                      </Text>
                      <Text style={styles.statusSep}>·</Text>
                      <Text style={styles.statusMeta}>{formatRadnoVrijeme(odabrana)}</Text>
                      <Text style={styles.statusSep}>·</Text>
                      <Ionicons name="time-outline" size={12} color={boje[guzvaZaPrikaz]} />
                      <Text style={[styles.statusMeta, { color: boje[guzvaZaPrikaz], fontWeight: '600' }]}>
                        {okvirnoČekanje(guzvaZaPrikaz, odabrana.kategorija)}
                      </Text>
                    </View>

                    <View style={styles.guzvaRow}>
                      <View style={[styles.guzvaDot, { backgroundColor: boje[guzvaZaPrikaz] }]} />
                      <Text style={[styles.guzvaLabel, { color: boje[guzvaZaPrikaz] }]}>
                        {svježe === 'nepoznato' ? 'Uobičajeno' : oznake[guzvaZaPrikaz]}
                      </Text>
                      {(odabrana.broj_prijava ?? 0) > 0 && svježe !== 'nepoznato' && (
                        <Text style={styles.prijaveSmall}>· {odabrana.broj_prijava} prijava</Text>
                      )}
                      {svježe === 'staro' && (
                        <Text style={styles.svjezinaStaro}>· {svjezinaLabel(odabrana.last_updated)} staro</Text>
                      )}
                    </View>
                  </>
                );
              })()}

              {/* Action gumbi */}
              <View style={styles.actionRow}>
                {korisnikLok && odabrana && (
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => { fetchRuta(odabrana); setOdabrana(null); setPrijaviMod(false); }}
                    disabled={rutaLoading}
                  >
                    <Ionicons name="navigate-outline" size={16} color="#dc2626" />
                    <Text style={styles.actionBtnOutlineText}>Prikaži put</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtnFill, prijaviMod && styles.actionBtnFillActive]}
                  onPress={() => setPrijaviMod(v => !v)}
                >
                  <Ionicons name="radio-button-on-outline" size={16} color="white" />
                  <Text style={styles.actionBtnFillText}>Prijavi gužvu</Text>
                </TouchableOpacity>
              </View>

              {/* Kada ići */}
              {odabrana && (
                <TouchableOpacity
                  style={styles.kadaIciBtn}
                  onPress={() => {
                    setOdabrana(null);
                    setPrijaviMod(false);
                    router.push({
                      pathname: '/lokacija/[id]',
                      params: {
                        id: String(odabrana.id),
                        naziv: odabrana.naziv,
                        kategorija: odabrana.kategorija,
                        pon_pet: odabrana.pon_pet ?? '',
                        subota: odabrana.subota ?? '',
                        nedjelja: odabrana.nedjelja ?? '',
                      },
                    });
                  }}
                >
                  <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                  <Text style={styles.kadaIciText}>Kada ići — vidi gužvu po satima</Text>
                  <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
                </TouchableOpacity>
              )}

              {/* Inline prijava — expandira se */}
              {prijaviMod && odabrana && (
                <View style={styles.prijaviRow}>
                  {[
                    { guzva: 'niska',    boja: '#22c55e', ikona: 'checkmark-circle-outline' as const, label: 'Nema' },
                    { guzva: 'umjerena', boja: '#f97316', ikona: 'alert-circle-outline' as const,     label: 'Umjerena' },
                    { guzva: 'visoka',   boja: '#ef4444', ikona: 'warning-outline' as const,          label: 'Visoka' },
                  ].map(({ guzva, boja, ikona, label }) => (
                    <TouchableOpacity
                      key={guzva}
                      style={[styles.prijaviBtn, { borderColor: boja }]}
                      onPress={() => { prijaviGuzvu(guzva); setPrijaviMod(false); }}
                    >
                      <Ionicons name={ikona} size={20} color={boja} />
                      <Text style={[styles.prijaviBtnText, { color: boja }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
  incidentDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  categoryMarker: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 6 },
  // Search
  searchContainer: { position: 'absolute', top: 56, left: 14, right: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  searchResults: { backgroundColor: 'white', borderRadius: 12, marginTop: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, overflow: 'hidden' },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10 },
  searchDot: { width: 8, height: 8, borderRadius: 4 },
  searchResultNaziv: { fontSize: 14, fontWeight: '600', color: '#111827' },
  searchResultKat: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  // Traffic toggle
  trafficBtn: { position: 'absolute', top: 164, right: 14, width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  trafficBtnOn: { backgroundColor: '#dc2626' },
  // Category filter
  filterContent: { paddingHorizontal: 4, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
  filterChipActive: { backgroundColor: '#dc2626' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: 'white' },
  // ETA bar
  etaBar: { position: 'absolute', bottom: 100, left: 14, right: 14, backgroundColor: 'white', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 8, borderLeftWidth: 4 },
  etaIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  etaNaziv: { fontSize: 14, fontWeight: '700', color: '#111827' },
  etaDetalji: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  etaClose: { padding: 4 },
  // Modal — lokacija
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalIkona: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', lineHeight: 22 },
  modalKat: { fontSize: 13, color: '#9ca3af', marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTekst: { fontSize: 13, fontWeight: '600' },
  statusSep: { fontSize: 13, color: '#d1d5db' },
  statusMeta: { fontSize: 13, color: '#6b7280' },
  guzvaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  guzvaDot: { width: 8, height: 8, borderRadius: 4 },
  guzvaLabel: { fontSize: 13, fontWeight: '600' },
  prijaveSmall: { fontSize: 12, color: '#9ca3af' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#dc2626', borderRadius: 12, paddingVertical: 12 },
  actionBtnOutlineText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  actionBtnFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 12 },
  actionBtnFillActive: { backgroundColor: '#b91c1c' },
  actionBtnFillText: { fontSize: 14, fontWeight: '600', color: 'white' },
  prijaviRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  prijaviBtn: { flex: 1, alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10 },
  prijaviBtnText: { fontSize: 12, fontWeight: '700' },
  svjezinaStaro: { fontSize: 12, color: '#f97316' },
  kadaIciBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 4 },
  kadaIciText: { flex: 1, fontSize: 13, color: '#6b7280' },
  // Modal — incident
  modalBtn: { padding: 16, borderRadius: 12, marginBottom: 10 },
  modalBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalBtnText: { color: 'white', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  modalOdustani: { textAlign: 'center', color: '#9ca3af', padding: 8, fontSize: 13 },
  tipGrid: { flexDirection: 'row', gap: 10, marginVertical: 16, flexWrap: 'wrap' },
  tipBtn: { flex: 1, minWidth: '40%', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#f3f4f6', gap: 4 },
  tipNaziv: { fontSize: 13, fontWeight: '600', color: '#374151' },
  opisInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', marginBottom: 12 },
  incidentDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  incidentDetailIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  incidentOpis: { fontSize: 15, color: '#374151', marginBottom: 8 },
  incidentExpiry: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
});
