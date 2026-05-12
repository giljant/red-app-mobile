import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RedLogo from '../components/RedLogo';
import { useRouter } from 'expo-router';

const KORACI: { ikona: keyof typeof Ionicons.glyphMap; naslov: string; opis: string }[] = [
  { ikona: 'location-outline', naslov: 'Pronađi lokaciju', opis: 'Pretraži pošte, banke, bolnice i još više' },
  { ikona: 'alert-circle-outline', naslov: 'Prijavi gužvu', opis: 'Javi drugima kolika je gužva kad si na licu mjesta' },
  { ikona: 'time-outline', naslov: 'Štedi vrijeme', opis: 'Dođi kad nema gužve, ne čekaj u redu' },
];

export default function Onboarding() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <RedLogo size={110} />
        <Text style={styles.tagline}>Zagreb bez čekanja</Text>
      </View>

      <View style={styles.middle}>
        {KORACI.map((k, i) => (
          <View key={i} style={styles.korak}>
            <View style={styles.iconWrap}>
              <Ionicons name={k.ikona} size={26} color="white" />
            </View>
            <View style={styles.korakTekst}>
              <Text style={styles.korakTitle}>{k.naslov}</Text>
              <Text style={styles.korakOpis}>{k.opis}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/login')}>
        <Text style={styles.btnText}>Počni koristiti</Text>
        <Ionicons name="arrow-forward" size={18} color="#dc2626" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dc2626', padding: 32, justifyContent: 'space-between' },
  top: { marginTop: 80, alignItems: 'center' },
  tagline: { color: '#fca5a5', fontSize: 18, marginTop: 10 },
  middle: { gap: 28 },
  korak: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  korakTekst: { flex: 1 },
  korakTitle: { color: 'white', fontSize: 17, fontWeight: '600' },
  korakOpis: { color: '#fca5a5', fontSize: 14, marginTop: 3 },
  btn: { backgroundColor: 'white', padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  btnText: { color: '#dc2626', fontSize: 17, fontWeight: 'bold' },
});