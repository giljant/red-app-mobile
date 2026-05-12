import { View, Text, StyleSheet } from 'react-native';

type Props = { size?: number };

export default function RedLogo({ size = 110 }: Props) {
  const u = size / 110;

  const person = (scale: number, mt: number) => (
    <View style={{ alignItems: 'center', marginTop: mt * u }}>
      <View style={{
        width: 18 * scale * u, height: 18 * scale * u,
        borderRadius: 9 * scale * u, backgroundColor: 'white',
      }} />
      <View style={{
        width: 22 * scale * u, height: 30 * scale * u,
        borderRadius: 11 * scale * u, backgroundColor: 'white',
        marginTop: 3 * u,
      }} />
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.figures}>
        {person(0.85, 6)}
        {person(1, 0)}
        {person(0.75, 10)}
      </View>
      <Text style={[styles.text, { fontSize: 28 * u, letterSpacing: 5 * u, marginTop: 10 * u }]}>
        RED
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  figures: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  text: { color: 'white', fontWeight: 'bold' },
});
