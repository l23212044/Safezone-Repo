/**
 * SafeZone – RiskDashboard.tsx
 * Panel de ponderación de riesgo por delegación
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Platform, ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import {
  calculateAllScores,
  loadSavedScores,
  ZoneScore,
  MAX_POINTS,
  LIMIT_LOW,
  LIMIT_MEDIUM,
  INCIDENT_WEIGHTS,
  classifyRisk,
  currentPeriodStart,
  currentPeriodEnd,
  formatDate,
} from '../config/riskEngine';

const COLORS = {
  bg:            '#0a0a0a',
  surface:       '#111111',
  border:        '#222222',
  accent:        '#2ECC71',
  accentLight:   '#58D68D',
  success:       '#27AE60',
  danger:        '#E74C3C',
  warning:       '#E67E22',
  purple:        '#a855f7',
  textPrimary:   '#FFFFFF',
  textSecondary: '#999999',
  inputBg:       '#1a1a1a',
};

const RISK_COLOR = {
  low:    COLORS.success,
  medium: COLORS.warning,
  high:   COLORS.danger,
};
const RISK_LABEL = { low: 'BAJO', medium: 'MEDIO', high: 'ALTO' };

// Delegaciones de MySQL
const ZONE_IDS = [
  'centro', 'la_mesa', 'otay-centenario', 'playas_de_tijuana',
  'san_antonio_de_los_buenos', 'sanchez_taboada',
  'cerro_colorado', 'la_presa', 'la_presa_este',
];

const TIPO_EMOJI: Record<string, string> = {
  accidente: '🚗', choque: '🚗', sospechoso: '👁',
  robo: '🔓', asalto: '⚠️', violencia: '🚨',
  secuestro: '🔒', homicidio: '💀', otro: '📋',
};

// ── Barra de progreso animada ─────────────────────────────────────────────────
function RiskBar({ percentage, color }: { percentage: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percentage,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={barStyles.track}>
      {/* Límite bajo (30%) */}
      <View style={[barStyles.limitLine, { left: `${LIMIT_LOW * 100}%` as any }]}>
        <View style={barStyles.limitDash} />
        <Text style={barStyles.limitLabel}>30%</Text>
      </View>
      {/* Límite medio (65%) */}
      <View style={[barStyles.limitLine, { left: `${LIMIT_MEDIUM * 100}%` as any }]}>
        <View style={barStyles.limitDash} />
        <Text style={barStyles.limitLabel}>65%</Text>
      </View>
      {/* Relleno */}
      <Animated.View style={[barStyles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 12, borderRadius: 6,
    backgroundColor: '#222222',
    overflow: 'visible',
    position: 'relative',
    marginVertical: 6,
  },
  fill: { height: '100%', borderRadius: 6, position: 'absolute', left: 0, top: 0 },
  limitLine: {
    position: 'absolute', top: -4, bottom: -4,
    alignItems: 'center', width: 1,
  },
  limitDash: { flex: 1, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  limitLabel: { fontSize: 8, color: '#999999', marginTop: 2, width: 24, textAlign: 'center' },
});

// ── Tarjeta de zona ───────────────────────────────────────────────────────────
function ZoneCard({ score, expanded, onToggle }: {
  score: ZoneScore;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = RISK_COLOR[score.risk];
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 60, friction: 12,
    }).start();
  }, [expanded]);

  return (
    <View style={[cardStyles.wrap, { borderColor: color + '40' }]}>
      <TouchableOpacity style={cardStyles.header} onPress={onToggle} activeOpacity={0.7}>
        {/* Nombre y badge */}
        <View style={cardStyles.titleRow}>
          <View style={[cardStyles.riskDot, { backgroundColor: color }]} />
          <Text style={cardStyles.zoneName} numberOfLines={1}>{score.zoneName}</Text>
          <View style={[cardStyles.riskBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
            <Text style={[cardStyles.riskBadgeText, { color }]}>{RISK_LABEL[score.risk]}</Text>
          </View>
        </View>

        {/* Barra */}
        <RiskBar percentage={score.percentage} color={color} />

        {/* Stats rápidas */}
        <View style={cardStyles.quickStats}>
          <Text style={[cardStyles.pctText, { color }]}>{score.percentage}%</Text>
          <Text style={cardStyles.quickStat}>{score.rawPoints} pts / {MAX_POINTS}</Text>
          <Text style={cardStyles.quickStat}>{score.reportCount} reportes</Text>
          <Text style={[cardStyles.expandIcon, { color: COLORS.textSecondary }]}>
            {expanded ? '▲' : '▼'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Desglose expandible */}
      {expanded && (
        <View style={cardStyles.breakdown}>
          <Text style={cardStyles.breakdownTitle}>Desglose del período</Text>
          {Object.entries(score.breakdown).length === 0 ? (
            <Text style={cardStyles.emptyText}>Sin incidentes este mes.</Text>
          ) : (
            Object.entries(score.breakdown)
              .sort((a, b) => b[1].points - a[1].points)
              .map(([tipo, { count, points }]) => (
                <View key={tipo} style={cardStyles.breakdownRow}>
                  <Text style={cardStyles.breakdownEmoji}>{TIPO_EMOJI[tipo] ?? '📋'}</Text>
                  <Text style={cardStyles.breakdownTipo}>{tipo}</Text>
                  <Text style={cardStyles.breakdownCount}>{count}×</Text>
                  <View style={cardStyles.breakdownBarWrap}>
                    <View style={[cardStyles.breakdownBar, { width: `${Math.min((points / MAX_POINTS) * 100, 100)}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={[cardStyles.breakdownPts, { color }]}>+{points.toFixed(1)}</Text>
                </View>
              ))
          )}
          <View style={cardStyles.periodRow}>
            <Text style={cardStyles.periodText}>📅 {score.periodStart} — {score.periodEnd}</Text>
            <Text style={cardStyles.periodText}>🕐 {new Date(score.updatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#111111', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  header: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  riskBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  quickStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pctText: { fontSize: 18, fontWeight: '800', minWidth: 52 },
  quickStat: { fontSize: 11, color: '#999999' },
  expandIcon: { marginLeft: 'auto' as any, fontSize: 10 },

  breakdown: { borderTopWidth: 1, borderTopColor: '#222222', padding: 14, gap: 8 },
  breakdownTitle: { fontSize: 11, fontWeight: '700', color: '#999999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#999999', textAlign: 'center', paddingVertical: 8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownEmoji: { fontSize: 14, width: 20 },
  breakdownTipo: { fontSize: 12, color: '#FFFFFF', width: 80, textTransform: 'capitalize' },
  breakdownCount: { fontSize: 11, color: '#999999', width: 24, textAlign: 'right' },
  breakdownBarWrap: { flex: 1, height: 6, backgroundColor: '#222222', borderRadius: 3, overflow: 'hidden' },
  breakdownBar: { height: '100%', borderRadius: 3 },
  breakdownPts: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  periodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#222222' },
  periodText: { fontSize: 11, color: '#999999' },
});

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function RiskDashboard({ navigation }: any) {
  const [scores, setScores]       = useState<ZoneScore[]>([]);
  const [loading, setLoading]     = useState(true);
  const [calculating, setCalc]    = useState(false);
  const [expandedId, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy]       = useState<'risk' | 'name' | 'reports'>('risk');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const periodStart = formatDate(currentPeriodStart());
  const periodEnd   = formatDate(currentPeriodEnd());

  useEffect(() => { loadScores(); }, []);

  const loadScores = async () => {
    setLoading(true);
    try {
      const saved = await loadSavedScores(ZONE_IDS);
      if (saved.length > 0) {
        setScores(saved);
      } else {
        await recalculate();
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  };

  const recalculate = async () => {
    setCalc(true);
    try {
      const result = await calculateAllScores(ZONE_IDS);
      setScores(result);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      console.error(e);
    } finally {
      setCalc(false);
      setLoading(false);
    }
  };

  const sorted = [...scores].sort((a, b) => {
    if (sortBy === 'risk') {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.risk] - order[b.risk];
    }
    if (sortBy === 'reports') return b.reportCount - a.reportCount;
    return a.zoneName.localeCompare(b.zoneName);
  });

  // Stats globales
  const totalReports = scores.reduce((s, z) => s + z.reportCount, 0);
  const highCount    = scores.filter(z => z.risk === 'high').length;
  const medCount     = scores.filter(z => z.risk === 'medium').length;
  const lowCount     = scores.filter(z => z.risk === 'low').length;
  const avgPct       = scores.length
    ? (scores.reduce((s, z) => s + z.percentage, 0) / scores.length).toFixed(1)
    : '0';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>⚖ Ponderación de Riesgo</Text>
          <Text style={styles.headerSub}>{periodStart} → {periodEnd}</Text>
        </View>
        <TouchableOpacity
          style={[styles.calcBtn, calculating && { opacity: 0.5 }]}
          onPress={recalculate}
          disabled={calculating}
        >
          {calculating
            ? <ActivityIndicator color={COLORS.accentLight} size="small" />
            : <Text style={styles.calcBtnText}>↻</Text>
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.loadingText}>Cargando puntuaciones...</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Escala de referencia */}
            <View style={styles.scaleBox}>
              <Text style={styles.scaleTitle}>Escala de ponderación · Máx {MAX_POINTS} pts = 100%</Text>
              <View style={styles.scaleTrack}>
                <View style={[styles.scaleSegment, { flex: 30, backgroundColor: COLORS.success + '40' }]} />
                <View style={[styles.scaleSegment, { flex: 35, backgroundColor: COLORS.warning + '40' }]} />
                <View style={[styles.scaleSegment, { flex: 35, backgroundColor: COLORS.danger + '40' }]} />
              </View>
              <View style={styles.scaleLabels}>
                <Text style={[styles.scaleLabel, { color: COLORS.success }]}>0–30% BAJO</Text>
                <Text style={[styles.scaleLabel, { color: COLORS.warning }]}>30–65% MEDIO</Text>
                <Text style={[styles.scaleLabel, { color: COLORS.danger }]}>65–100% ALTO</Text>
              </View>
            </View>

            {/* Stats globales */}
            <View style={styles.globalStats}>
              <View style={styles.gStatCard}>
                <Text style={[styles.gStatNum, { color: COLORS.danger }]}>{highCount}</Text>
                <Text style={styles.gStatLabel}>Alto riesgo</Text>
              </View>
              <View style={styles.gStatCard}>
                <Text style={[styles.gStatNum, { color: COLORS.warning }]}>{medCount}</Text>
                <Text style={styles.gStatLabel}>Riesgo medio</Text>
              </View>
              <View style={styles.gStatCard}>
                <Text style={[styles.gStatNum, { color: COLORS.success }]}>{lowCount}</Text>
                <Text style={styles.gStatLabel}>Bajo riesgo</Text>
              </View>
              <View style={styles.gStatCard}>
                <Text style={[styles.gStatNum, { color: COLORS.accentLight }]}>{totalReports}</Text>
                <Text style={styles.gStatLabel}>Reportes mes</Text>
              </View>
            </View>

            {/* Tabla de pesos */}
            <View style={styles.weightsBox}>
              <Text style={styles.weightsTitle}>Tabla de pesos por incidente</Text>
              {Object.entries(INCIDENT_WEIGHTS)
                .sort((a, b) => b[1] - a[1])
                .map(([tipo, weight]) => (
                  <View key={tipo} style={styles.weightRow}>
                    <Text style={styles.weightEmoji}>{TIPO_EMOJI[tipo] ?? '📋'}</Text>
                    <Text style={styles.weightTipo}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</Text>
                    <View style={styles.weightBarWrap}>
                      <View style={[styles.weightBar, {
                        width: `${(weight / 4) * 100}%` as any,
                        backgroundColor: weight >= 3 ? COLORS.danger : weight >= 2 ? COLORS.warning : weight >= 1 ? COLORS.accentLight : COLORS.success,
                      }]} />
                    </View>
                    <Text style={[styles.weightVal, {
                      color: weight >= 3 ? COLORS.danger : weight >= 2 ? COLORS.warning : weight >= 1 ? COLORS.accentLight : COLORS.success,
                    }]}>{weight} pts</Text>
                  </View>
                ))}
            </View>

            {/* Ordenar */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Ordenar por:</Text>
              {(['risk', 'reports', 'name'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
                  onPress={() => setSortBy(s)}
                >
                  <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                    {s === 'risk' ? '⚠ Riesgo' : s === 'reports' ? '📋 Reportes' : '🔤 Nombre'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tarjetas por zona */}
            {sorted.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No hay datos este mes.</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={recalculate}>
                  <Text style={styles.emptyBtnText}>Calcular ahora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              sorted.map(score => (
                <ZoneCard
                  key={score.zoneId}
                  score={score}
                  expanded={expandedId === score.zoneId}
                  onToggle={() => setExpanded(expandedId === score.zoneId ? null : score.zoneId)}
                />
              ))
            )}

            {/* Nota de reset mensual */}
            <View style={styles.resetNote}>
              <Text style={styles.resetNoteText}>
                🔄 La ponderación se reinicia automáticamente el primer día de cada mes.
                {'\n'}Próximo reinicio: <Text style={{ color: COLORS.accentLight }}>{periodEnd}</Text>
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: COLORS.textPrimary },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  calcBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.3)', alignItems: 'center', justifyContent: 'center' },
  calcBtnText: { fontSize: 18, color: COLORS.accentLight },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },

  scaleBox: { margin: 16, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  scaleTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  scaleTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  scaleSegment: { height: '100%' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scaleLabel: { fontSize: 10, fontWeight: '700' },

  globalStats: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  gStatCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10, alignItems: 'center' },
  gStatNum: { fontSize: 22, fontWeight: '800' },
  gStatLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  weightsBox: { marginHorizontal: 16, marginBottom: 14, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  weightsTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  weightEmoji: { fontSize: 14, width: 20 },
  weightTipo: { fontSize: 12, color: COLORS.textPrimary, width: 90, textTransform: 'capitalize' },
  weightBarWrap: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  weightBar: { height: '100%', borderRadius: 3 },
  weightVal: { fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  sortLabel: { fontSize: 11, color: COLORS.textSecondary },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBg },
  sortBtnActive: { backgroundColor: 'rgba(46,204,113,0.2)', borderColor: 'rgba(46,204,113,0.5)' },
  sortBtnText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  sortBtnTextActive: { color: COLORS.accentLight },

  emptyBox: { alignItems: 'center', padding: 40, gap: 16 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.accent },
  emptyBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  resetNote: { marginHorizontal: 16, marginTop: 8, backgroundColor: 'rgba(46,204,113,0.05)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.15)', borderRadius: 12, padding: 14 },
  resetNoteText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 20 },
});