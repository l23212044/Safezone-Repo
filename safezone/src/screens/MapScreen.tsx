/**
 * SafeZone – MapScreen.tsx  (versión MySQL)
 * Polígonos por delegación con % de riesgo y # de reportes tomados de
 * GET /indice-riesgo. Se refresca cada 15 s y cada vez que la pantalla toma foco.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform, Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch, getSession, logout, SessionUser } from '../config/authService';

const COLORS = {
  bg: '#0a0a0a', surface: '#111111', border: '#222222',
  accent: '#2ECC71', accentLight: '#58D68D',
  success: '#27AE60', danger: '#E74C3C', warning: '#E67E22',
  textPrimary: '#FFFFFF', textSecondary: '#999999',
};

type RiskLevel = 'high' | 'medium' | 'low';
const RISK_MAP: Record<string, RiskLevel> = { alto: 'high', medio: 'medium', bajo: 'low' };

interface Zone {
  id: string; name: string; description: string; risk: RiskLevel;
  lat: number; lng: number; incidents: number; tips: string[];
}
interface Score { percentage: number; rawPoints: number; reportCount: number; risk: RiskLevel; }

// id = id de la delegación en MySQL (1..9). El riesgo inicial es solo un respaldo sin conexión.
const BASE_ZONES: Zone[] = [
  { id:'1', name:'Centro',                    description:'Alta actividad delictiva nocturna',           risk:'high',   lat:32.5149, lng:-117.0382, incidents:0, tips:['Evita transitar después de las 10 PM','Mantén tus pertenencias seguras','Usa rutas iluminadas'] },
  { id:'2', name:'La Mesa',                   description:'Zona residencial con incidentes ocasionales', risk:'medium', lat:32.7200, lng:-117.0200, incidents:0, tips:['Precaución en horarios nocturnos','Reporta actividad sospechosa'] },
  { id:'3', name:'Otay-Centenario',           description:'Zona industrial con cruces fronterizos',      risk:'high',   lat:32.5500, lng:-116.9200, incidents:0, tips:['No uses el celular en la vía pública','Viaja acompañado'] },
  { id:'4', name:'Playas de Tijuana',         description:'Zona turística con bajo riesgo',              risk:'low',    lat:32.5300, lng:-117.1200, incidents:0, tips:['Zona relativamente segura','Precaución normal en playa'] },
  { id:'5', name:'San Antonio de los Buenos', description:'Zona residencial tranquila',                  risk:'low',    lat:32.4950, lng:-117.0650, incidents:0, tips:['Zona de bajo riesgo','Mantén precaución básica'] },
  { id:'6', name:'Sánchez Taboada',           description:'Zona con incidentes moderados',               risk:'medium', lat:32.5050, lng:-116.9900, incidents:0, tips:['Precaución en estacionamientos','Usa transporte seguro de noche'] },
  { id:'7', name:'Cerro Colorado',            description:'Zona residencial con riesgo moderado',        risk:'medium', lat:32.5400, lng:-116.9700, incidents:0, tips:['Seguro de día, precaución de noche','Usa taxis de aplicación'] },
  { id:'8', name:'La Presa',                  description:'Zona periférica con incidentes altos',        risk:'high',   lat:32.5600, lng:-116.8900, incidents:0, tips:['Evita zonas apartadas','Viaja en grupo','Reporta incidentes'] },
  { id:'9', name:'La Presa Este',             description:'Zona periférica con riesgo moderado',         risk:'medium', lat:32.5200, lng:-116.8600, incidents:0, tips:['Precaución básica','Evita circular de noche solo'] },
];

const RISK_CONFIG = {
  high:   { color: '#E74C3C', label: 'ALTO',  fillOpacity: 0.35 },
  medium: { color: '#E67E22', label: 'MEDIO', fillOpacity: 0.30 },
  low:    { color: '#27AE60', label: 'BAJO',  fillOpacity: 0.25 },
};

const TIJUANA_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    { type:'Feature', properties:{id:'1',name:'Centro'},                    geometry:{type:'Polygon',coordinates:[[[-117.0700,32.5350],[-117.0200,32.5350],[-117.0100,32.5100],[-117.0200,32.4950],[-117.0600,32.4950],[-117.0750,32.5150],[-117.0700,32.5350]]]} },
    { type:'Feature', properties:{id:'2',name:'La Mesa'},                   geometry:{type:'Polygon',coordinates:[[[-117.0200,32.5350],[-116.9600,32.5350],[-116.9400,32.5200],[-116.9500,32.4950],[-117.0100,32.4950],[-117.0100,32.5100],[-117.0200,32.5350]]]} },
    { type:'Feature', properties:{id:'3',name:'Otay-Centenario'},           geometry:{type:'Polygon',coordinates:[[[-117.0200,32.5350],[-116.9600,32.5350],[-116.9400,32.5500],[-116.9000,32.5600],[-116.8900,32.5400],[-116.9200,32.5150],[-116.9400,32.5200],[-117.0200,32.5350]]]} },
    { type:'Feature', properties:{id:'4',name:'Playas de Tijuana'},         geometry:{type:'Polygon',coordinates:[[[-117.1500,32.5600],[-117.0700,32.5600],[-117.0700,32.5350],[-117.1000,32.5100],[-117.1300,32.5000],[-117.1600,32.5100],[-117.1600,32.5400],[-117.1500,32.5600]]]} },
    { type:'Feature', properties:{id:'5',name:'San Antonio de los Buenos'}, geometry:{type:'Polygon',coordinates:[[[-117.1000,32.5100],[-117.0700,32.5350],[-117.0750,32.5150],[-117.0600,32.4950],[-117.0600,32.4700],[-117.0900,32.4700],[-117.1100,32.4900],[-117.1000,32.5100]]]} },
    { type:'Feature', properties:{id:'6',name:'Sánchez Taboada'},           geometry:{type:'Polygon',coordinates:[[[-117.0100,32.4950],[-116.9500,32.4950],[-116.9300,32.4750],[-116.9500,32.4500],[-117.0000,32.4500],[-117.0200,32.4700],[-117.0100,32.4950]]]} },
    { type:'Feature', properties:{id:'7',name:'Cerro Colorado'},            geometry:{type:'Polygon',coordinates:[[[-116.9600,32.5350],[-116.9400,32.5200],[-116.9200,32.5150],[-116.9000,32.5000],[-116.9300,32.4750],[-116.9500,32.4950],[-117.0100,32.4950],[-117.0100,32.5100],[-116.9600,32.5350]]]} },
    { type:'Feature', properties:{id:'8',name:'La Presa'},                  geometry:{type:'Polygon',coordinates:[[[-116.9000,32.5600],[-116.8500,32.5700],[-116.8200,32.5500],[-116.8300,32.5200],[-116.8700,32.5100],[-116.9000,32.5000],[-116.9200,32.5150],[-116.9000,32.5400],[-116.9000,32.5600]]]} },
    { type:'Feature', properties:{id:'9',name:'La Presa Este'},             geometry:{type:'Polygon',coordinates:[[[-116.8700,32.5100],[-116.8300,32.5200],[-116.8100,32.4900],[-116.8300,32.4700],[-116.8700,32.4800],[-116.9000,32.5000],[-116.8700,32.5100]]]} },
  ],
};

export default function MapScreen({ navigation }: any) {
  const [user, setUser]         = useState<SessionUser | null>(null);
  const [scores, setScores]     = useState<Record<string, Score>>({});
  const [online, setOnline]     = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter]     = useState<RiskLevel | 'all'>('all');
  const [showLegend, setShowLegend] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  const isAdmin = user?.rol === 'admin';
  useEffect(() => { getSession().then(setUser); }, []);

  // ── Datos desde MySQL ────────────────────────────────────────────────────────
  const fetchScores = useCallback(async () => {
    try {
      const rows = await apiFetch('/indice-riesgo');
      const next: Record<string, Score> = {};
      rows.forEach((r: any) => {
        next[String(r.delegacion_id)] = {
          percentage:  Number(r.porcentaje),
          rawPoints:   Number(r.puntos_totales),
          reportCount: Number(r.total_reportes),
          risk:        RISK_MAP[r.nivel_riesgo] ?? 'low',
        };
      });
      // Solo actualiza si cambió algo (evita recargar el mapa en cada consulta)
      setScores(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchScores();
    const t = setInterval(fetchScores, 15000);
    return () => clearInterval(t);
  }, [fetchScores]));

  // Zonas con riesgo y # de reportes reales
  const zones: Zone[] = useMemo(() => BASE_ZONES.map(z => {
    const sc = scores[z.id];
    return sc ? { ...z, risk: sc.risk, incidents: sc.reportCount } : z;
  }), [scores]);

  const filtered = filter === 'all' ? zones : zones.filter(z => z.risk === filter);
  const selected = selectedId ? zones.find(z => z.id === selectedId) ?? null : null;
  const selScore = selected ? scores[selected.id] : undefined;

  const handleLogout = async () => { await logout(); navigation.replace('Login'); };

  // ── Mapa Leaflet ─────────────────────────────────────────────────────────────
  const mapHTML = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#0a0a0a}
    .leaflet-tile-pane{filter:brightness(0.75) saturate(0.5) hue-rotate(200deg)}
    .leaflet-control-zoom,.leaflet-control-attribution{display:none}
    .zone-label{background:transparent!important;border:none!important;box-shadow:none!important;pointer-events:none;}
  </style>
  </head><body><div id="map"></div><script>
  const map = L.map('map',{center:[32.520,-117.010],zoom:11,zoomControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  const zones   = ${JSON.stringify(filtered)};
  const cfg     = ${JSON.stringify(RISK_CONFIG)};
  const geoData = ${JSON.stringify(TIJUANA_GEOJSON)};
  const scores  = ${JSON.stringify(scores)};
  const zoneMap = {};
  zones.forEach(z => { zoneMap[z.id] = z; });

  function pctColor(p){ return p < 30 ? '#27AE60' : (p <= 65 ? '#E67E22' : '#E74C3C'); }

  L.geoJSON(geoData, {
    style: function(f) {
      const z = zoneMap[f.properties.id];
      if (!z) return { color:'#222222', weight:1, fillColor:'#222222', fillOpacity:0.05 };
      const c = cfg[z.risk];
      return { color:c.color, weight:2, opacity:0.9, fillColor:c.color, fillOpacity:c.fillOpacity };
    },
    onEachFeature: function(f, layer) {
      const z = zoneMap[f.properties.id];
      if (!z) return;
      const c  = cfg[z.risk];
      const sc = scores[f.properties.id];
      const pct = sc ? sc.percentage : null;
      const rep = sc ? sc.reportCount : z.incidents;
      layer.on('click', function(){ window.ReactNativeWebView.postMessage(JSON.stringify({id:z.id})); });
      const center = layer.getBounds().getCenter();
      L.marker(center, {
        icon: L.divIcon({
          className: 'zone-label',
          html:
            '<div style="text-align:center;line-height:1.4;font-family:monospace">' +
              '<span style="font-size:9px;color:' + c.color + ';letter-spacing:1px;font-weight:700">' + c.label + '</span><br>' +
              '<span style="font-size:10px;color:#FFFFFF;font-weight:700">' + f.properties.name + '</span><br>' +
              '<span style="font-size:11px;color:' + (pct===null ? '#999999' : pctColor(pct)) + ';font-weight:800">' + (pct===null ? '--' : pct + '%') + '</span>' +
              '<span style="font-size:9px;color:#999999"> · ' + rep + ' rep</span>' +
            '</div>',
          iconSize: [130, 48], iconAnchor: [65, 24],
        }),
        interactive: false,
      }).addTo(map);
    },
  }).addTo(map);

  zones.forEach(z => {
    L.circleMarker([z.lat, z.lng], { radius:6, color:'#fff', fillColor:cfg[z.risk].color, fillOpacity:1, weight:2 })
      .addTo(map)
      .on('click', function(){ window.ReactNativeWebView.postMessage(JSON.stringify({id:z.id})); });
  });
  </script></body></html>`;

  const openPanel = (id: string) => {
    setSelectedId(id);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };
  const closePanel = () => {
    Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true })
      .start(() => setSelectedId(null));
  };
  const onMessage = (e: any) => {
    try { const { id } = JSON.parse(e.nativeEvent.data); if (zones.some(z => z.id === id)) openPanel(id); } catch {}
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <WebView style={{ flex: 1 }} source={{ html: mapHTML }} onMessage={onMessage} javaScriptEnabled originWhitelist={['*']} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoText}>SZ</Text></View>
          <View>
            <Text style={s.headerTitle}>SafeZone</Text>
            <Text style={s.headerSub}>Tijuana · {filtered.length} delegaciones</Text>
          </View>
        </View>
        <View style={s.headerBtns}>
          {isAdmin && (
            <TouchableOpacity style={[s.headerBtn, { borderColor: 'rgba(46,204,113,0.5)' }]} onPress={() => navigation.replace('Admin')}>
              <Text style={[s.headerBtnText, { color: COLORS.accentLight }]}>⚙ Panel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.headerBtn, showLegend && { borderColor: COLORS.accentLight }]} onPress={() => setShowLegend(v => !v)}>
            <Text style={s.headerBtnText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.headerBtn, { borderColor: 'rgba(231,76,60,0.5)' }]} onPress={handleLogout}>
            <Text style={[s.headerBtnText, { color: COLORS.danger }]}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Leyenda */}
      {showLegend && (
        <View style={s.legend}>
          <Text style={s.legendTitle}>Riesgo ponderado · 120 pts = 100%</Text>
          <View style={s.legendScale}>
            <Text style={[s.legendScaleText, { color: COLORS.success }]}>0–30% BAJO</Text>
            <Text style={[s.legendScaleText, { color: COLORS.warning }]}>30–65% MEDIO</Text>
            <Text style={[s.legendScaleText, { color: COLORS.danger }]}>65%+ ALTO</Text>
          </View>
          <View style={s.legendDivider} />
          {zones.map(z => {
            const sc = scores[z.id];
            return (
              <View key={z.id} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: RISK_CONFIG[z.risk].color }]} />
                <Text style={s.legendName} numberOfLines={1}>{z.name}</Text>
                <Text style={[s.legendPct, { color: RISK_CONFIG[z.risk].color }]}>{sc ? sc.percentage + '%' : '–'}</Text>
                <Text style={s.legendRep}>{z.incidents} rep</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Filtros */}
      <View style={s.filterRow}>
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterBtnOn]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextOn]}>{f === 'all' ? 'Todas' : RISK_CONFIG[f].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Aviso sin conexión */}
      {!online && (
        <View style={s.offline}>
          <Text style={s.offlineText}>⚠ Sin conexión al servidor · datos locales</Text>
        </View>
      )}

      {/* FAB reportar */}
      {!selected && (
        <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('Report', { zoneName: '' })}>
          <Text style={{ fontSize: 18 }}>🚨</Text>
          <Text style={s.fabText}>Reportar</Text>
        </TouchableOpacity>
      )}

      {/* Panel de zona */}
      {selected && (
        <Animated.View style={[s.panel, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />
          <View style={s.panelHeader}>
            <View style={[s.badge, { backgroundColor: RISK_CONFIG[selected.risk].color + '22', borderColor: RISK_CONFIG[selected.risk].color + '55' }]}>
              <Text style={[s.badgeText, { color: RISK_CONFIG[selected.risk].color }]}>RIESGO {RISK_CONFIG[selected.risk].label}</Text>
            </View>
            <TouchableOpacity onPress={closePanel}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <Text style={s.panelName}>{selected.name}</Text>
          <Text style={s.panelDesc}>{selected.description}</Text>

          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: RISK_CONFIG[selected.risk].color }]}>{selScore ? selScore.percentage + '%' : '–'}</Text>
              <Text style={s.statLabel}>Ponderación</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: RISK_CONFIG[selected.risk].color }]}>{selScore ? selScore.reportCount : selected.incidents}</Text>
              <Text style={s.statLabel}>Reportes/mes</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statNum}>{selScore ? selScore.rawPoints.toFixed(1) : '–'}</Text>
              <Text style={s.statLabel}>Puntos/120</Text>
            </View>
          </View>

          {selScore && (
            <View style={{ marginBottom: 16 }}>
              <View style={s.track}>
                <View style={[s.limit, { left: '30%' }]} />
                <View style={[s.limit, { left: '65%' }]} />
                <View style={[s.fill, { width: (Math.min(selScore.percentage, 100) + '%') as any, backgroundColor: RISK_CONFIG[selected.risk].color }]} />
              </View>
              <View style={s.trackLabels}>
                <Text style={[s.trackLabel, { color: COLORS.success }]}>30%</Text>
                <Text style={[s.trackLabel, { color: COLORS.warning }]}>65%</Text>
                <Text style={[s.trackLabel, { color: COLORS.danger }]}>100%</Text>
              </View>
            </View>
          )}

          <Text style={s.tipsTitle}>Recomendaciones</Text>
          {selected.tips.map((tip, i) => (
            <View key={i} style={s.tipRow}><Text style={s.tipDot}>›</Text><Text style={s.tipText}>{tip}</Text></View>
          ))}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.btnReport} onPress={() => navigation.navigate('Report', { zoneName: selected.name })}>
              <Text style={s.btnReportText}>🚨 Reportar incidente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnRoute}><Text style={s.btnRouteText}>Ruta alternativa →</Text></TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const TOP = Platform.OS === 'ios' ? 110 : 100;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(10,10,10,0.92)', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 14, fontWeight: '700', color: '#fff' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 1 },
  headerSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  headerBtns: { flexDirection: 'row', gap: 6 },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.05)' },
  headerBtnText: { fontSize: 12, color: COLORS.accentLight, fontWeight: '500' },

  legend: { position: 'absolute', top: TOP + 44, right: 16, backgroundColor: 'rgba(17,17,17,0.97)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, gap: 6, maxWidth: 260 },
  legendTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  legendScale: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  legendScaleText: { fontSize: 9, fontWeight: '700' },
  legendDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendName: { flex: 1, fontSize: 11, color: COLORS.textSecondary },
  legendPct: { fontSize: 11, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  legendRep: { fontSize: 10, color: COLORS.textSecondary, minWidth: 40, textAlign: 'right' },

  filterRow: { position: 'absolute', top: TOP, left: 16, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(17,17,17,0.9)' },
  filterBtnOn: { backgroundColor: 'rgba(46,204,113,0.25)', borderColor: 'rgba(46,204,113,0.6)' },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterTextOn: { color: COLORS.accentLight },

  offline: { position: 'absolute', bottom: 40, left: 16, right: 150, backgroundColor: 'rgba(231,76,60,0.15)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.4)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  offlineText: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },

  fab: { position: 'absolute', bottom: 32, right: 16, backgroundColor: COLORS.danger, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 8 },
  fabText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: COLORS.border, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  close: { fontSize: 16, color: COLORS.textSecondary },
  panelName: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  panelDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 10, color: COLORS.textSecondary },
  track: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, position: 'relative', marginBottom: 4 },
  limit: { position: 'absolute', top: -2, bottom: -2, width: 1.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: '100%', borderRadius: 5, position: 'absolute', left: 0, top: 0 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  trackLabel: { fontSize: 9, fontWeight: '700' },
  tipsTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  tipDot: { fontSize: 16, color: COLORS.accentLight, lineHeight: 20 },
  tipText: { fontSize: 13, color: COLORS.textPrimary, flex: 1, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnReport: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(231,76,60,0.1)', alignItems: 'center' },
  btnReportText: { fontSize: 13, fontWeight: '600', color: '#E74C3C' },
  btnRoute: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
  btnRouteText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});