import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { formatPotpunoRadnoVrijeme } from '../../utils/radnoVrijeme';

const API = 'http://10.100.200.134:3000';

const DANI_KRATKO = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
const DANI_PUNO = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

const boje: Record<number, string> = {
  0: '#22c55e',   // niska
};

function scoreToColor(score: number): string {
  if (score < 0.5) return '#22c55e';
  if (score < 1.2) return '#f97316';
  return '#ef4444';
}

function scoreToLabel(score: number): 'niska' | 'umjerena' | 'visoka' {
  if (score < 0.5) return 'niska';
  if (score < 1.2) return 'umjerena';
  return 'visoka';
}

type StatRow = { dan: number; sat: number; avg_score: number; broj: number };
type Preporuka = { dan: string; danIndex: number; sat: number; label: string };

export default function KadaIciScreen() {
  const { id, naziv, kategorija, pon_pet, subota, nedjelja } = useLocalSearchParams<{
    id: string;
    naziv: string;
    kategorija: string;
    pon_pet: string;
    subota: string;
    nedjelja: string;
  }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [podaci, setPodaci] = useState<StatRow[]>([]);
  const [preporuka, setPreporuka] = useState<Preporuka | null>(null);
  const [odabraniDan, setOdabraniDan] = useState(new Date().getDay());

  useEffect(() => {
    fetch(`${API}/api/statistike/${id}`)
      .then(r => r.json())
      .then(data => {
        setPodaci(data.podaci ?? []);
        setPreporuka(data.preporuka ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const rv = { pon_pet: pon_pet ?? null, subota: subota ?? null, nedjelja: nedjelja ?? null };
  const rvLinije = formatPotpunoRadnoVrijeme(rv);

  // Satni podaci za odabrani dan
  const danPodaci = podaci.filter(r => r.dan === odabraniDan);
  const maxScore = Math.max(...danPodaci.map(r => r.avg_score), 2);

  // Sati 7–20 kao x-os
  const sati = Array.from({ length: 14 }, (_, i) => i + 7);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{naziv}</Text>
          <Text style={styles.headerSub}>{kategorija}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Preporuka */}
        {preporuka && (
          <View style={styles.preporukaCard}>
            <View style={styles.preporukaIcon}>
              <Ionicons name="star" size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.preporukaTitle}>Najmanji red</Text>
              <Text style={styles.preporukaLabel}>{preporuka.label}</Text>
            </View>
          </View>
        )}

        {!preporuka && !loading && (
          <View style={styles.preporukaCard}>
            <View style={styles.preporukaIcon}>
              <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.preporukaTitle}>Nema dovoljno podataka</Text>
              <Text style={styles.preporukaLabel}>Prijavi gužvu kako bi pomogao drugima</Text>
            </View>
          </View>
        )}

        {/* Dan selector */}
        <Text style={styles.sectionLabel}>Gužva po satu</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.danScroll} contentContainerStyle={styles.danContent}>
          {DANI_KRATKO.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.danChip, odabraniDan === i && styles.danChipActive]}
              onPress={() => setOdabraniDan(i)}
            >
              <Text style={[styles.danChipText, odabraniDan === i && styles.danChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#dc2626" />
          </View>
        ) : (
          <View style={styles.chartCard}>
            <Text style={styles.chartDan}>{DANI_PUNO[odabraniDan]}</Text>
            {danPodaci.length === 0 ? (
              <Text style={styles.nemaUnosaTekst}>Nema podataka za ovaj dan</Text>
            ) : (
              <View style={styles.chart}>
                {sati.map(sat => {
                  const row = danPodaci.find(r => r.sat === sat);
                  const score = row?.avg_score ?? 0;
                  const height = row ? Math.max(4, (score / maxScore) * 80) : 4;
                  const color = row ? scoreToColor(score) : '#e5e7eb';
                  return (
                    <View key={sat} style={styles.barWrap}>
                      <View style={[styles.bar, { height, backgroundColor: color }]} />
                      <Text style={styles.barLabel}>{sat}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.legenda}>
              {[['#22c55e', 'Mali red'], ['#f97316', 'Umjeren'], ['#ef4444', 'Visok']].map(([c, l]) => (
                <View key={l} style={styles.legendaItem}>
                  <View style={[styles.legendaDot, { backgroundColor: c }]} />
                  <Text style={styles.legendaText}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Radno vrijeme */}
        <Text style={styles.sectionLabel}>Radno vrijeme</Text>
        <View style={styles.rvCard}>
          {rvLinije.map((l, i) => (
            <Text key={i} style={styles.rvLine}>{l}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#dc2626', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#fca5a5', fontSize: 12, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  preporukaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  preporukaIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
  preporukaTitle: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  preporukaLabel: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  danScroll: { marginBottom: 12 },
  danContent: { gap: 8 },
  danChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6' },
  danChipActive: { backgroundColor: '#dc2626' },
  danChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  danChipTextActive: { color: 'white' },
  loadingWrap: { height: 120, justifyContent: 'center', alignItems: 'center' },
  chartCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  chartDan: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 16 },
  nemaUnosaTekst: { textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingVertical: 20 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 100, paddingBottom: 20 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 3, minHeight: 4 },
  barLabel: { fontSize: 9, color: '#9ca3af', marginTop: 4 },
  legenda: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaDot: { width: 8, height: 8, borderRadius: 4 },
  legendaText: { fontSize: 11, color: '#6b7280' },
  rvCard: { backgroundColor: 'white', borderRadius: 14, padding: 16, gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  rvLine: { fontSize: 14, color: '#374151', fontWeight: '500' },
});
