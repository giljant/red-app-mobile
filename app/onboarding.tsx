import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Onboarding() {
  const router = useRouter();

  async function zavrsiOnboarding() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.logo}>RED</Text>
        <Text style={styles.tagline}>Zagreb bez čekanja</Text>
      </View>

      <View style={styles.middle}>
        <View style={styles.korak}>
          <Text style={styles.emoji}>📍</Text>
          <View>
            <Text style={styles.korakTitle}>Pronađi lokaciju</Text>
            <Text style={styles.korakOpis}>Pretraži pošte, banke, bolnice i još više</Text>
          </View>
        </View>
        <View style={styles.korak}>
          <Text style={styles.emoji}>🔴</Text>
          <View>
            <Text style={styles.korakTitle}>Prijavi gužvu</Text>
            <Text style={styles.korakOpis}>Javi drugima kolika je gužva kad si na licu mjesta</Text>
          </View>
        </View>
        <View style={styles.korak}>
          <Text style={styles.emoji}>⏱️</Text>
          <View>
            <Text style={styles.korakTitle}>Štedi vrijeme</Text>
            <Text style={styles.korakOpis}>Dođi kad nema gužve, ne čekaj u redu</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.btn} onPress={zavrsiOnboarding}>
        <Text style={styles.btnText}>Počni koristiti →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#dc2626', padding: 32, justifyContent: 'space-between' },
  top: { marginTop: 80, alignItems: 'center' },
  logo: { color: 'white', fontSize: 56, fontWeight: 'bold', letterSpacing: 4 },
  tagline: { color: '#fca5a5', fontSize: 18, marginTop: 8 },
  middle: { gap: 28 },
  korak: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  emoji: { fontSize: 32 },
  korakTitle: { color: 'white', fontSize: 17, fontWeight: '600' },
  korakOpis: { color: '#fca5a5', fontSize: 14, marginTop: 2 },
  btn: { backgroundColor: 'white', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 32 },
  btnText: { color: '#dc2626', fontSize: 17, fontWeight: 'bold' },
});