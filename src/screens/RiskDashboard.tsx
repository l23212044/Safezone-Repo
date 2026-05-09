import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { calculateAllScores, currentPeriodEnd, currentPeriodStart, formatDate, INCIDENT_WEIGHTS, LIMIT_LOW, LIMIT_MEDIUM, loadSavedScores, MAX_POINTS, ZoneScore } from '../config/riskEngine';

const COLORS = { bg: '#07090f', surface: '#0d1117', border: '#1e2530', accent: '#1a6bff', accentLight: '#7ab4ff', success: '#30e890', danger: '#ff3737', warning: '#ffbb30', textPrimary: '#e0e8f0', textSecondary: '#8899aa', inputBg: '#111820' };
const RISK_COLOR = { low: COLORS.success, medium: COLORS.warning, high: COLORS.danger };
const RISK_LABEL = { low: 'BAJO', medium: 'MEDIO', high: 'ALTO' };
const ZONE_IDS = ['centro', 'la_mesa', 'otay-centenario', 'playas_de_tijuana', 'san_antonio_de_los_buenos', 'sanchez_taboada', 'cerro_colorado', 'la_presa', 'la_presa_este'];
const TIPO_EMOJI: Record<string, string> = { accidente: '🚗', choque: '🚗', sospechoso: '👁', robo: '🔓', asalto: '⚠️', violencia: '🚨', secuestro: '🔒', homicidio: '💀', otro: '📋' };

function ZoneCard({ score }: { score: ZoneScore }) {
  const color = RISK_COLOR[score.risk];
  return (
    <View style={[styles.card, { borderColor: color + '55' }]}>
      <View style={styles.cardTitleRow}><View style={[styles.riskDot, { backgroundColor: color }]} /><Text style={styles.zoneName}>{score.zoneName}</Text><Text style={[styles.badge, { color, borderColor: color + '55' }]}>{RISK_LABEL[score.risk]}</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${score.percentage}%`, backgroundColor: color }]} /></View>
      <View style={styles.statsRow}><Text style={[styles.percent, { color }]}>{score.percentage}%</Text><Text style={styles.muted}>{score.rawPoints} pts / {MAX_POINTS}</Text><Text style={styles.muted}>{score.reportCount} reportes</Text></View>
      {Object.entries(score.breakdown).map(([tipo, item]) => <Text key={tipo} style={styles.breakdown}>{TIPO_EMOJI[tipo] ?? '📋'} {tipo}: {item.count}× · {item.points.toFixed(1)} pts</Text>)}
    </View>
  );
}

export default function RiskDashboard({ navigation }: any) {
  const [scores, setScores] = useState<ZoneScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const periodStart = formatDate(currentPeriodStart());
  const periodEnd = formatDate(currentPeriodEnd());

  const recalculate = async () => {
    setCalculating(true);
    try { setScores(await calculateAllScores(ZONE_IDS)); } finally { setCalculating(false); setLoading(false); }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await loadSavedScores(ZONE_IDS);
        if (saved.length) setScores(saved); else await recalculate();
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const riskOrder: Record<ZoneScore['risk'], number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...scores].sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
  const totalReports = scores.reduce((sum, score) => sum + score.reportCount, 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}><TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Text style={styles.backBtnText}>←</Text></TouchableOpacity><View style={styles.headerCenter}><Text style={styles.headerTitle}>⚖ Ponderación de Riesgo</Text><Text style={styles.headerSub}>{periodStart} → {periodEnd}</Text></View><TouchableOpacity style={styles.calcBtn} onPress={recalculate} disabled={calculating}>{calculating ? <ActivityIndicator color={COLORS.accentLight} /> : <Text style={styles.calcBtnText}>↻</Text>}</TouchableOpacity></View>
      {loading ? <View style={styles.loadingBox}><ActivityIndicator color={COLORS.accent} size="large" /><Text style={styles.muted}>Cargando puntuaciones...</Text></View> : <ScrollView showsVerticalScrollIndicator={false}><View style={styles.scaleBox}><Text style={styles.scaleTitle}>Escala de ponderación · Máx {MAX_POINTS} pts = 100%</Text><Text style={styles.muted}>Bajo: 0–{LIMIT_LOW * 100}% · Medio: {LIMIT_LOW * 100}–{LIMIT_MEDIUM * 100}% · Alto: {LIMIT_MEDIUM * 100}–100%</Text></View><View style={styles.weightsBox}><Text style={styles.scaleTitle}>Tabla de pesos por incidente</Text>{Object.entries(INCIDENT_WEIGHTS).map(([tipo, weight]) => <Text key={tipo} style={styles.weight}>{TIPO_EMOJI[tipo] ?? '📋'} {tipo}: {weight} pts</Text>)}</View><Text style={styles.total}>Reportes del mes: {totalReports}</Text>{sorted.map(score => <ZoneCard key={score.zoneId} score={score} />)}<View style={{ height: 40 }} /></ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg }, header: { paddingTop: 44, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border }, backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }, backBtnText: { fontSize: 18, color: COLORS.textPrimary }, headerCenter: { flex: 1, alignItems: 'center' }, headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary }, headerSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }, calcBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(26,107,255,0.1)', borderWidth: 1, borderColor: 'rgba(26,107,255,0.3)', alignItems: 'center', justifyContent: 'center' }, calcBtnText: { fontSize: 18, color: COLORS.accentLight }, loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }, muted: { fontSize: 12, color: COLORS.textSecondary }, scaleBox: { margin: 16, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 }, weightsBox: { marginHorizontal: 16, marginBottom: 14, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 }, scaleTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }, weight: { color: COLORS.textPrimary, marginBottom: 6 }, total: { color: COLORS.accentLight, fontWeight: '700', marginHorizontal: 16, marginBottom: 12 }, card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, padding: 14 }, cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, riskDot: { width: 8, height: 8, borderRadius: 4 }, zoneName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary }, badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '800' }, track: { height: 12, borderRadius: 6, backgroundColor: COLORS.border, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 6 }, statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }, percent: { fontSize: 18, fontWeight: '800' }, breakdown: { color: COLORS.textPrimary, fontSize: 12, marginTop: 6 },
});
