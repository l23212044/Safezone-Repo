import React, { useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ReportModal from '../components/ReportModal';

export default function ReportScreen({ navigation, route }: any) {
  const [visible, setVisible] = useState(true);
  const zoneName = route?.params?.zoneName ?? '';
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#07090f" />
      <Text style={styles.title}>Reportes SafeZone</Text>
      <TouchableOpacity style={styles.button} onPress={() => setVisible(true)}><Text style={styles.buttonText}>Abrir modal de reporte</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}><Text style={styles.secondaryText}>Volver</Text></TouchableOpacity>
      <ReportModal visible={visible} onClose={() => setVisible(false)} zoneName={zoneName} zoneId="" zoneLat={0} zoneLng={0} />
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#07090f', padding: 24, justifyContent: 'center' }, title: { color: '#e0e8f0', fontSize: 24, fontWeight: '800', marginBottom: 24 }, button: { backgroundColor: '#ff3737', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 }, buttonText: { color: '#fff', fontWeight: '700' }, secondary: { borderWidth: 1, borderColor: '#1e2530', borderRadius: 14, padding: 16, alignItems: 'center' }, secondaryText: { color: '#7ab4ff', fontWeight: '700' } });
