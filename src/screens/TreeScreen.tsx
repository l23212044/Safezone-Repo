import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TreeScreen({ navigation }: any) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#07090f" />
      <Text style={styles.title}>Árbol de navegación</Text>
      <Text style={styles.item}>Login → Map → Report / RiskDashboard / Admin</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Volver</Text></TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#07090f', padding: 24, justifyContent: 'center' }, title: { color: '#e0e8f0', fontSize: 24, fontWeight: '800', marginBottom: 12 }, item: { color: '#8899aa', marginBottom: 24 }, button: { backgroundColor: '#1a6bff', borderRadius: 14, padding: 16, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '700' } });
