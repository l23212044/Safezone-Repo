import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AdminScreen({ navigation }: any) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#07090f" />
      <Text style={styles.title}>🛡 Panel administrador</Text>
      <Text style={styles.subtitle}>Gestiona reportes, revisa ponderaciones y navega al mapa.</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('RiskDashboard')}><Text style={styles.buttonText}>Ver ponderación de riesgo</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => navigation.replace('Map')}><Text style={styles.secondaryText}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#07090f', padding: 24, justifyContent: 'center' }, title: { color: '#e0e8f0', fontSize: 26, fontWeight: '800', marginBottom: 8 }, subtitle: { color: '#8899aa', fontSize: 14, lineHeight: 20, marginBottom: 24 }, button: { backgroundColor: '#1a6bff', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 }, buttonText: { color: '#fff', fontWeight: '700' }, secondary: { borderWidth: 1, borderColor: '#1e2530', borderRadius: 14, padding: 16, alignItems: 'center' }, secondaryText: { color: '#7ab4ff', fontWeight: '700' } });
