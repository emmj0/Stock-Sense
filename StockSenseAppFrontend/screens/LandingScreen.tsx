import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type LandingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Landing'>;

interface Props {
  navigation: LandingScreenNavigationProp;
}

const sampleStocks = [
  { symbol: 'PSX', name: 'Pakistan Stock Exchange', price: 3200.45, change: 1.25 },
  { symbol: 'HBL', name: 'Habib Bank Ltd', price: 145.2, change: -0.9 },
  { symbol: 'OGDC', name: 'Oil & Gas Dev', price: 89.5, change: 0.6 },
  { symbol: 'LUCK', name: 'Lucky Cement', price: 102.35, change: -2.15 },
];

export default function LandingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>StockSense</Text>
      <Text style={styles.subtitle}>AI-driven virtual portfolios & market insights</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.secondaryText}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Market Snapshot</Text>

      <FlatList
        data={sampleStocks}
        keyExtractor={(item) => item.symbol}
        style={{ width: '100%' }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>PKR {item.price.toFixed(2)}</Text>
              <Text style={[styles.change, { color: item.change >= 0 ? '#138000' : '#c62828' }]}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</Text>
            </View>
          </View>
        )}
      />

      <Text style={styles.footer}>Built for learning — simulated trading only</Text>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f6f9fc', alignItems: 'center' },
  brand: { fontSize: 32, fontWeight: '800', color: '#0b3d91' },
  subtitle: { color: '#3b4a5a', marginTop: 6, marginBottom: 18, textAlign: 'center' },
  actions: { flexDirection: 'row', marginBottom: 18 },
  primary: { backgroundColor: '#0b61ff', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, marginRight: 10 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#e9f0ff', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  secondaryText: { color: '#0843a6', fontWeight: '700' },
  sectionTitle: { alignSelf: 'flex-start', fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  card: { width: width - 40, backgroundColor: '#fff', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  symbol: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 12, color: '#69707a' },
  price: { fontSize: 16, fontWeight: '700' },
  change: { marginTop: 4, fontSize: 12 },
  footer: { marginTop: 12, color: '#7a8896', fontSize: 12 },
});
