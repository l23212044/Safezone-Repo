/**
 * SafeZone – ReportScreen.tsx  (versión MySQL)
 * 3 pasos: zona (GPS o manual) → tipo → descripción.
 * Envía a POST /reportes con el token del usuario; la API recalcula el índice.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform,
  ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { apiFetch, getSession, SessionUser } from '../config/authService';

const COLORS = {
  bg: '#0a0a0a', surface: '#111111', border: '#222222',
  accent: '#2ECC71', accentLight: '#58D68D',
  success: '#27AE60', danger: '#E74C3C', warning: '#E67E22',
  textPrimary: '#FFFFFF', textSecondary: '#999999', inputBg: '#1a1a1a',
};

// Deben coincidir con la tabla `delegaciones` de MySQL
const ZONAS = [
  { name: 'Centro',                    lat: 32.5149, lng: -117.0382 },
  { name: 'La Mesa',                   lat: 32.7200, lng: -117.0200 },
  { name: 'Otay-Centenario',           lat: 32.5500, lng: -116.9200 },
  { name: 'Playas de Tijuana',         lat: 32.5300, lng: -117.1200 },
  { name: 'San Antonio de los Buenos', lat: 32.4950, lng: -117.0650 },
  { name: 'Sánchez Taboada',           lat: 32.5050, lng: -116.9900 },
  { name: 'Cerro Colorado',            lat: 32.5400, lng: -116.9700 },
  { name: 'La Presa',                  lat: 32.5600, lng: -116.8900 },
  { name: 'La Presa Este',             lat: 32.5200, lng: -116.8600 },
];

// `id` = clave en tipos_incidente; el peso lo aplica el servidor
const TIPOS = [
  { id: 'accidente',  emoji: '🚗', label: 'Accidente / choque',   pts: '0.5' },
  { id: 'sospechoso', emoji: '👁',  label: 'Actividad sospechosa', pts: '1'   },
  { id: 'robo',       emoji: '🔓', label: 'Robo',                 pts: '1.5' },
  { id: 'asalto',     emoji: '⚠️', label: 'Asalto armado',        pts: '2'   },
  { id: 'violencia',  emoji: '🚨', label: 'Robo con violencia',   pts: '2'   },
  { id: 'secuestro',  emoji: '🔒', label: 'Secuestro',            pts: '3'   },
  { id: 'homicidio',  emoji: '💀', label: 'Homicidio',            pts: '4'   },
  { id: 'otro',       emoji: '📋', label: 'Otro',                 pts: '0.5' },
];

// Distancia en km entre dos coordenadas (haversine)
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestZone(lat: number, lng: number) {
  return ZONAS.reduce((best, z) =>
    km(lat, lng, z.lat, z.lng) < km(lat, lng, best.lat, best.lng) ? z : best);
}

export default function ReportScreen({ navigation, route }: any) {
  const pre = route?.params?.zoneName ?? '';
  const [user, setUser]         = useState<SessionUser | null>(null);
  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [zona, setZona]         = useState(ZONAS.some(z => z.name === pre) ? pre : '');
  const [tipo, setTipo]         = useState('');
  const [desc, setDesc]         = useState('');
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  useEffect(() => { getSession().then(setUser); }, []);

  const useMyLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos tu ubicación para detectar la zona. Puedes elegirla manualmente.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCoords(c);
      setZona(nearestZone(c.lat, c.lng).name);
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación. Verifica que el GPS esté activado.');
    } finally {
      setLocLoading(false);
    }
  };

  const submit = async () => {
    if (!user)        { Alert.alert('Sesión requerida', 'Inicia sesión para enviar un reporte.'); return; }
    if (!zona || !tipo || !desc.trim()) { Alert.alert('Faltan datos', 'Completa zona, tipo y descripción.'); return; }
    setLoading(true);
    try {
      await apiFetch('/reportes', {
        method: 'POST',
        body: JSON.stringify({ zona_nombre: zona, tipo_nombre: tipo, descripcion: desc.trim() }),
      });
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('No se pudo enviar', e.message ?? 'Verifica tu conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setStep(1); setZona(''); setTipo(''); setDesc(''); setCoords(null); setSuccess(false); };
  const tipoSel = TIPOS.find(t => t.id === tipo);

  // ── Éxito ──
  if (success) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={s.okScreen}>
          <View style={s.okIcon}><Text style={s.okIconText}>✓</Text></View>
          <Text style={s.okTitle}>Reporte enviado</Text>
          <Text style={s.okSub}>El índice de riesgo de la zona ya se actualizó con tu reporte.</Text>
          <View style={s.okInfo}>
            <Text style={s.okInfoText}>📍 {zona}</Text>
            <Text style={s.okInfoText}>{tipoSel?.emoji} {tipoSel?.label} · +{tipoSel?.pts} pts</Text>
            <Text style={s.okInfoText}>👤 {user?.email}</Text>
          </View>
          <TouchableOpacity style={s.btnPrimary} onPress={reset}><Text style={s.btnPrimaryText}>Hacer otro reporte</Text></TouchableOpacity>
          <TouchableOpacity style={s.btnGhost} onPress={() => navigation.goBack()}><Text style={s.btnGhostText}>← Volver al mapa</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}><Text style={s.backText}>←</Text></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.title}>Reportar incidente</Text>
          <Text style={s.sub}>Paso {step} de 3</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.progress}><View style={[s.progressFill, { width: `${(step / 3) * 100}%` as any }]} /></View>

      <View style={s.userBar}>
        <View style={[s.dot, { backgroundColor: user ? COLORS.success : COLORS.danger }]} />
        <Text style={s.userText}>{user ? `Sesión activa: ${user.email}` : 'Sin sesión'}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {step === 1 && (
            <View style={s.step}>
              <Text style={s.stepTitle}>📍 ¿Dónde ocurrió?</Text>
              <Text style={s.stepSub}>Usa tu ubicación para detectar la delegación o elígela manualmente.</Text>

              <TouchableOpacity style={s.gpsBtn} onPress={useMyLocation} disabled={locLoading}>
                {locLoading ? <ActivityIndicator color={COLORS.accentLight} size="small" />
                            : <Text style={s.gpsText}>📡 Usar mi ubicación actual</Text>}
              </TouchableOpacity>
              {coords && (
                <View style={s.gpsOk}>
                  <Text style={s.gpsOkText}>✓ Zona detectada: {zona} · puedes cambiarla abajo</Text>
                </View>
              )}

              <View style={s.grid}>
                {ZONAS.map(z => (
                  <TouchableOpacity key={z.name} style={[s.chip, zona === z.name && s.chipOn]} onPress={() => setZona(z.name)}>
                    <Text style={[s.chipText, zona === z.name && s.chipTextOn]}>{z.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[s.btnPrimary, !zona && { opacity: 0.4 }]} disabled={!zona} onPress={() => setStep(2)}>
                <Text style={s.btnPrimaryText}>Siguiente →</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={s.step}>
              <Text style={s.stepTitle}>⚠ Tipo de incidente</Text>
              <Text style={s.stepSub}>Cada tipo suma puntos al índice de riesgo de la zona.</Text>
              <View style={s.tipoGrid}>
                {TIPOS.map(t => (
                  <TouchableOpacity key={t.id} style={[s.tipoCard, tipo === t.id && s.tipoOn]} onPress={() => setTipo(t.id)}>
                    <Text style={s.tipoEmoji}>{t.emoji}</Text>
                    <Text style={[s.tipoLabel, tipo === t.id && s.tipoLabelOn]}>{t.label}</Text>
                    <Text style={s.tipoPts}>{t.pts} pts</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.navRow}>
                <TouchableOpacity style={s.btnBack} onPress={() => setStep(1)}><Text style={s.btnGhostText}>← Anterior</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btnPrimary, { flex: 1 }, !tipo && { opacity: 0.4 }]} disabled={!tipo} onPress={() => setStep(3)}>
                  <Text style={s.btnPrimaryText}>Siguiente →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={s.step}>
              <Text style={s.stepTitle}>📝 Descripción</Text>
              <Text style={s.stepSub}>Describe brevemente lo que ocurrió.</Text>
              <TextInput
                style={s.textArea} multiline maxLength={500} textAlignVertical="top"
                placeholder="Ej: Dos personas intentaron robar en la esquina de..."
                placeholderTextColor={COLORS.textSecondary} value={desc} onChangeText={setDesc}
              />
              <Text style={s.count}>{desc.length}/500</Text>

              <View style={s.summary}>
                <Text style={s.summaryTitle}>Resumen</Text>
                <Row k="📍 Zona" v={zona} />
                <Row k="⚠ Tipo" v={`${tipoSel?.emoji} ${tipoSel?.label} (+${tipoSel?.pts})`} />
                <Row k="📡 GPS" v={coords ? 'Usado para detectar zona' : 'No usado'} />
                <Row k="👤 Usuario" v={user?.email ?? '—'} />
              </View>

              <View style={s.navRow}>
                <TouchableOpacity style={s.btnBack} onPress={() => setStep(2)}><Text style={s.btnGhostText}>← Anterior</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btnSubmit, { flex: 1 }, (loading || !desc.trim()) && { opacity: 0.5 }]}
                                  disabled={loading || !desc.trim()} onPress={submit}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimaryText}>🚨 Enviar reporte</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={s.row}><Text style={s.rowK}>{k}</Text><Text style={s.rowV} numberOfLines={1}>{v}</Text></View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border },
  backText: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  progress: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: '100%', backgroundColor: COLORS.accent },
  userBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(46,204,113,0.06)', borderBottomWidth: 1, borderBottomColor: 'rgba(46,204,113,0.15)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  userText: { fontSize: 12, color: COLORS.accentLight },

  step: { padding: 20 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  stepSub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 20 },

  gpsBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(46,204,113,0.5)', backgroundColor: 'rgba(46,204,113,0.1)', marginBottom: 12 },
  gpsText: { fontSize: 14, color: COLORS.accentLight, fontWeight: '600' },
  gpsOk: { backgroundColor: 'rgba(39,174,96,0.08)', borderWidth: 1, borderColor: 'rgba(39,174,96,0.3)', borderRadius: 10, padding: 10, marginBottom: 16 },
  gpsOkText: { fontSize: 12, color: COLORS.success, fontWeight: '500' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBg },
  chipOn: { backgroundColor: 'rgba(46,204,113,0.2)', borderColor: 'rgba(46,204,113,0.6)' },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextOn: { color: COLORS.accentLight, fontWeight: '700' },

  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  tipoCard: { width: '47.5%', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBg, alignItems: 'center', gap: 4 },
  tipoOn: { backgroundColor: 'rgba(231,76,60,0.12)', borderColor: 'rgba(231,76,60,0.5)' },
  tipoEmoji: { fontSize: 24 },
  tipoLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', textAlign: 'center' },
  tipoLabelOn: { color: COLORS.danger, fontWeight: '700' },
  tipoPts: { fontSize: 11, color: COLORS.warning, fontWeight: '700' },

  textArea: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.textPrimary, minHeight: 120 },
  count: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4, marginBottom: 16 },

  summary: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 20 },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowK: { fontSize: 13, color: COLORS.textSecondary },
  rowV: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  navRow: { flexDirection: 'row', gap: 10 },
  btnBack: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
  btnPrimaryText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  btnSubmit: { paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.danger, alignItems: 'center' },
  btnGhost: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', width: '100%' },
  btnGhostText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

  okScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  okIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(39,174,96,0.15)', borderWidth: 2, borderColor: 'rgba(39,174,96,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  okIconText: { fontSize: 36, color: COLORS.success },
  okTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  okSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  okInfo: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, width: '100%', gap: 10, marginBottom: 24 },
  okInfoText: { fontSize: 13, color: COLORS.textPrimary },
});