/**
 * SafeZone – AdminScreen.tsx  (versión MySQL)
 * Pestañas: Reportes · Usuarios (+ correos bloqueados) · Accesos (logs) · Riesgo
 * Todas las llamadas usan apiFetch con el token JWT del administrador.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform, ScrollView,
  ActivityIndicator, RefreshControl, TextInput, Alert, Modal,
} from 'react-native';
import { apiFetch, getSession, logout, SessionUser } from '../config/authService';

const COLORS = {
  bg: '#0a0a0a', surface: '#111111', border: '#222222',
  accent: '#2ECC71', accentLight: '#58D68D',
  success: '#27AE60', danger: '#E74C3C', warning: '#E67E22',
  textPrimary: '#FFFFFF', textSecondary: '#999999', inputBg: '#1a1a1a',
};

type Tab = 'reportes' | 'usuarios' | 'accesos' | 'riesgo';

const emojiFor = (tipo = '') => {
  const t = tipo.toLowerCase();
  if (t.includes('robo con') || t.includes('violenc')) return '🚨';
  if (t.includes('robo'))       return '🔓';
  if (t.includes('asalto'))     return '⚠️';
  if (t.includes('accid') || t.includes('choque')) return '🚗';
  if (t.includes('sospech'))    return '👁';
  if (t.includes('secuestro'))  return '🔒';
  if (t.includes('homicid'))    return '💀';
  return '📋';
};

const fecha = (v?: string) =>
  v ? new Date(v).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ESTADO_COLOR: Record<string, string> = {
  activo: COLORS.warning, revisado: COLORS.success, rechazado: COLORS.danger,
  archivado: COLORS.textSecondary, suspendido: COLORS.danger, inactivo: COLORS.textSecondary,
};
const EVENTO_COLOR: Record<string, string> = {
  login_ok: COLORS.success, admin_ok: COLORS.accentLight, registro: COLORS.accentLight,
  logout: COLORS.textSecondary, login_fail: COLORS.danger, admin_fail: COLORS.danger, bloqueado: COLORS.warning,
};
const RISK_COLOR: Record<string, string> = { bajo: COLORS.success, medio: COLORS.warning, alto: COLORS.danger };

export default function AdminScreen({ navigation }: any) {
  const [me, setMe]             = useState<SessionUser | null>(null);
  const [tab, setTab]           = useState<Tab>('reportes');
  const [reportes, setReportes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [bloqueos, setBloqueos] = useState<any[]>([]);
  const [logs, setLogs]         = useState<any[]>([]);
  const [indice, setIndice]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState<'todos' | 'activo' | 'revisado' | 'rechazado'>('todos');

  // Modal bloquear correo
  const [blockModal, setBlockModal] = useState(false);
  const [bEmail, setBEmail]     = useState('');
  const [bMotivo, setBMotivo]   = useState('');
  const [bError, setBError]     = useState('');
  // Modal editar usuario
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editNombre, setEditNombre] = useState('');

  const handleLogout = async () => { await logout(); navigation.replace('Login'); };

  const load = useCallback(async () => {
    setError('');
    try {
      const [rep, usr, blk, lg, idx] = await Promise.all([
        apiFetch('/reportes'), apiFetch('/admin/usuarios'), apiFetch('/admin/bloqueos'),
        apiFetch('/admin/logs'), apiFetch('/indice-riesgo'),
      ]);
      setReportes(rep); setUsuarios(usr); setBloqueos(blk); setLogs(lg); setIndice(idx);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo conectar con el servidor.');
      if (/sesi|autenticado/i.test(e.message ?? '')) handleLogout();
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { getSession().then(setMe); load(); }, [load]);

  // Ejecuta una acción y recarga los datos
  const act = async (fn: () => Promise<any>) => {
    try { await fn(); await load(); }
    catch (e: any) { Alert.alert('Error', e.message ?? 'No se pudo completar la acción.'); }
  };

  const confirm = (title: string, msg: string, onOk: () => void, destructive = true) =>
    Alert.alert(title, msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: destructive ? 'destructive' : 'default', onPress: onOk },
    ]);

  // ── Reportes ─────────────────────────────────────────────────────────────────
  const setEstadoReporte = (id: number, estado: string) =>
    act(() => apiFetch(`/reportes/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }));

  const archivarReporte = (id: number) =>
    confirm('Eliminar reporte', 'Se archivará y dejará de sumar al índice de riesgo.',
      () => act(() => apiFetch(`/reportes/${id}`, { method: 'DELETE' })));

  // ── Usuarios ─────────────────────────────────────────────────────────────────
  const toggleEstado = (u: any) => {
    const nuevo = u.estado === 'activo' ? 'suspendido' : 'activo';
    confirm(nuevo === 'suspendido' ? 'Suspender usuario' : 'Reactivar usuario', u.email,
      () => act(() => apiFetch(`/admin/usuarios/${u.id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) })),
      nuevo === 'suspendido');
  };

  const eliminarUsuario = (u: any) =>
    confirm('Eliminar usuario', `${u.email}\nSe borra la cuenta; sus reportes se conservan.`,
      () => act(() => apiFetch(`/admin/usuarios/${u.id}`, { method: 'DELETE' })));

  const guardarNombre = async () => {
    if (!editUser || !editNombre.trim()) return;
    await act(() => apiFetch(`/admin/usuarios/${editUser.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: editNombre.trim() }) }));
    setEditUser(null);
  };

  const bloquearCorreo = async () => {
    if (!/\S+@\S+\.\S+/.test(bEmail)) { setBError('Correo inválido.'); return; }
    if (!bMotivo.trim())              { setBError('Indica el motivo.');  return; }
    try {
      await apiFetch('/admin/bloqueos', { method: 'POST', body: JSON.stringify({ email: bEmail.trim(), motivo: bMotivo.trim() }) });
      setBlockModal(false); setBEmail(''); setBMotivo(''); setBError('');
      load();
    } catch (e: any) { setBError(e.message); }
  };

  const desbloquear = (b: any) =>
    confirm('Desbloquear correo', b.email,
      () => act(() => apiFetch(`/admin/bloqueos/${encodeURIComponent(b.email)}`, { method: 'DELETE' })), false);

  // ── Derivados ────────────────────────────────────────────────────────────────
  const pendientes = reportes.filter(r => r.estado === 'activo').length;
  const revisados  = reportes.filter(r => r.estado === 'revisado').length;
  const reportesFiltrados = filter === 'todos' ? reportes : reportes.filter(r => r.estado === filter);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.hLeft}>
          <View style={s.logoBox}><Text style={{ fontSize: 18 }}>⚙</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.hTitle}>Panel Admin</Text>
            <Text style={s.hSub} numberOfLines={1}>{me?.email}</Text>
          </View>
        </View>
        <View style={s.hBtns}>
          <TouchableOpacity style={s.hBtn} onPress={() => navigation.navigate('Tree')}><Text style={s.hBtnText}>🌳</Text></TouchableOpacity>
          <TouchableOpacity style={s.hBtn} onPress={() => navigation.navigate('RiskDashboard')}><Text style={s.hBtnText}>⚖</Text></TouchableOpacity>
          <TouchableOpacity style={s.hBtn} onPress={() => navigation.replace('Map')}><Text style={s.hBtnText}>Mapa</Text></TouchableOpacity>
          <TouchableOpacity style={[s.hBtn, { borderColor: 'rgba(231,76,60,0.4)', backgroundColor: 'rgba(231,76,60,0.08)' }]} onPress={handleLogout}>
            <Text style={[s.hBtnText, { color: COLORS.danger, fontWeight: '600' }]}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resumen */}
      <View style={s.statsRow}>
        <Stat n={pendientes} label="Activos"    color={COLORS.warning} />
        <Stat n={revisados}  label="Revisados"  color={COLORS.success} />
        <Stat n={usuarios.length} label="Usuarios" color={COLORS.accentLight} />
        <Stat n={bloqueos.length} label="Bloqueados" color={COLORS.danger} />
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {([['reportes', '📋 Reportes'], ['usuarios', '👥 Usuarios'], ['accesos', '🔐 Accesos'], ['riesgo', '📊 Riesgo']] as [Tab, string][]).map(([t, label]) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={load}><Text style={s.retry}>Reintentar</Text></TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /><Text style={s.muted}>Cargando datos...</Text></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}>

          {/* ───────── REPORTES ───────── */}
          {tab === 'reportes' && (
            <>
              <View style={s.filterRow}>
                {(['todos', 'activo', 'revisado', 'rechazado'] as const).map(f => (
                  <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipOn]} onPress={() => setFilter(f)}>
                    <Text style={[s.chipText, filter === f && s.chipTextOn]}>{f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {reportesFiltrados.length === 0 && <Text style={s.empty}>No hay reportes.</Text>}
              {reportesFiltrados.map(r => (
                <View key={r.id} style={s.card}>
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle}>{emojiFor(r.tipo)} {String(r.tipo).toUpperCase()}</Text>
                    <Badge text={r.estado} color={ESTADO_COLOR[r.estado] ?? COLORS.textSecondary} />
                  </View>
                  <Text style={s.zona}>📍 {r.zona}  ·  +{r.peso_capturado} pts</Text>
                  <Text style={s.desc}>{r.descripcion}</Text>
                  <Text style={s.meta}>👤 {r.usuario_email ?? 'anónimo'}  •  🕐 {fecha(r.creado_en)}</Text>
                  <View style={s.actions}>
                    {r.estado === 'activo' && (
                      <Btn label="✓ Revisado" color={COLORS.success} flex onPress={() => setEstadoReporte(r.id, 'revisado')} />
                    )}
                    {(r.estado === 'activo' || r.estado === 'revisado') && (
                      <Btn label="✕ Rechazar" color={COLORS.warning} flex onPress={() => setEstadoReporte(r.id, 'rechazado')} />
                    )}
                    {r.estado !== 'archivado' && <Btn label="🗑" color={COLORS.danger} onPress={() => archivarReporte(r.id)} />}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ───────── USUARIOS ───────── */}
          {tab === 'usuarios' && (
            <>
              <View style={s.sectionRow}>
                <Text style={s.section}>Usuarios registrados ({usuarios.length})</Text>
                <TouchableOpacity style={s.blockBtn} onPress={() => { setBError(''); setBlockModal(true); }}>
                  <Text style={s.blockBtnText}>+ Bloquear correo</Text>
                </TouchableOpacity>
              </View>

              {usuarios.map(u => (
                <View key={u.id} style={s.card}>
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle} numberOfLines={1}>{u.nombre || 'Sin nombre'}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {u.rol === 'admin' && <Badge text="admin" color={COLORS.accentLight} />}
                      <Badge text={u.estado} color={ESTADO_COLOR[u.estado] ?? COLORS.textSecondary} />
                    </View>
                  </View>
                  <Text style={s.zona}>✉ {u.email}</Text>
                  <Text style={s.meta}>{u.matricula ? `Matrícula ${u.matricula}  •  ` : ''}Alta {fecha(u.creado_en)}</Text>
                  <View style={s.actions}>
                    <Btn label="✏ Editar" color={COLORS.accentLight} flex onPress={() => { setEditUser(u); setEditNombre(u.nombre ?? ''); }} />
                    <Btn label={u.estado === 'activo' ? '⏸ Suspender' : '▶ Reactivar'} color={u.estado === 'activo' ? COLORS.warning : COLORS.success} flex onPress={() => toggleEstado(u)} />
                    {u.id !== me?.id && <Btn label="🗑" color={COLORS.danger} onPress={() => eliminarUsuario(u)} />}
                  </View>
                </View>
              ))}

              <Text style={[s.section, { marginTop: 18 }]}>Correos bloqueados ({bloqueos.length})</Text>
              <View style={s.info}><Text style={s.infoText}>Un correo bloqueado no puede registrarse ni iniciar sesión, exista o no la cuenta.</Text></View>
              {bloqueos.length === 0 && <Text style={s.empty}>No hay correos bloqueados.</Text>}
              {bloqueos.map(b => (
                <View key={b.email} style={[s.card, { borderColor: 'rgba(231,76,60,0.3)' }]}>
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle} numberOfLines={1}>🚫 {b.email}</Text>
                    <Text style={s.meta}>{fecha(b.fecha)}</Text>
                  </View>
                  <Text style={s.desc}>Motivo: {b.motivo || '—'}</Text>
                  <View style={s.actions}><Btn label="✓ Desbloquear" color={COLORS.success} flex onPress={() => desbloquear(b)} /></View>
                </View>
              ))}
            </>
          )}

          {/* ───────── ACCESOS (logs) ───────── */}
          {tab === 'accesos' && (
            <>
              <Text style={[s.section, { paddingTop: 16 }]}>Últimos {logs.length} accesos</Text>
              {logs.length === 0 && <Text style={s.empty}>Sin registros.</Text>}
              {logs.map(l => (
                <View key={l.id} style={s.logRow}>
                  <View style={[s.logDot, { backgroundColor: EVENTO_COLOR[l.evento] ?? COLORS.textSecondary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.logEmail} numberOfLines={1}>{l.email ?? '—'}</Text>
                    <Text style={s.meta}>{fecha(l.creado_en)}  •  {l.ip || 'ip desconocida'}</Text>
                  </View>
                  <Text style={[s.logEvento, { color: EVENTO_COLOR[l.evento] ?? COLORS.textSecondary }]}>{String(l.evento).replace('_', ' ')}</Text>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </>
          )}

          {/* ───────── RIESGO ───────── */}
          {tab === 'riesgo' && (
            <>
              <Text style={[s.section, { paddingTop: 16 }]}>Índice por delegación · 120 pts = 100%</Text>
              <View style={s.info}>
                <Text style={s.infoText}>Pesos: accidente/choque 0.5 · sospechosa 1 · robo 1.5 · asalto/violencia 2 · secuestro 3 · homicidio 4. Bajo &lt;30% · Medio 30–65% · Alto &gt;65%. Cuentan los reportes activos y revisados.</Text>
              </View>
              {indice.map(i => {
                const c = RISK_COLOR[i.nivel_riesgo] ?? COLORS.textSecondary;
                return (
                  <View key={i.delegacion_id} style={s.card}>
                    <View style={s.cardTop}>
                      <Text style={s.cardTitle}>{i.delegacion}</Text>
                      <Badge text={i.nivel_riesgo} color={c} />
                    </View>
                    <View style={s.bar}><View style={[s.barFill, { width: (Math.min(Number(i.porcentaje), 100) + '%') as any, backgroundColor: c }]} /></View>
                    <Text style={s.meta}>{Number(i.porcentaje)}%  •  {Number(i.puntos_totales)} / 120 pts  •  {i.total_reportes} reportes</Text>
                  </View>
                );
              })}
              <View style={{ height: 20 }} />
            </>
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* Modal: bloquear correo */}
      <Modal visible={blockModal} transparent animationType="slide" onRequestClose={() => setBlockModal(false)}>
        <View style={s.overlay}><View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>🚫 Bloquear correo</Text>
          <Text style={s.sheetSub}>No podrá registrarse ni iniciar sesión.</Text>
          <Text style={s.label}>Correo</Text>
          <TextInput style={s.input} placeholder="usuario@ejemplo.com" placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" keyboardType="email-address" value={bEmail} onChangeText={setBEmail} />
          <Text style={s.label}>Motivo</Text>
          <TextInput style={[s.input, { minHeight: 80 }]} placeholder="Ej: reportes falsos" placeholderTextColor={COLORS.textSecondary} multiline textAlignVertical="top" value={bMotivo} onChangeText={setBMotivo} />
          {!!bError && <Text style={s.sheetError}>⚠ {bError}</Text>}
          <View style={s.sheetBtns}>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setBlockModal(false)}><Text style={s.sheetCancelText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={s.sheetOk} onPress={bloquearCorreo}><Text style={s.sheetOkText}>Bloquear</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Modal: editar usuario */}
      <Modal visible={!!editUser} transparent animationType="slide" onRequestClose={() => setEditUser(null)}>
        <View style={s.overlay}><View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>✏ Editar usuario</Text>
          <Text style={s.sheetSub}>{editUser?.email}</Text>
          <Text style={s.label}>Nombre</Text>
          <TextInput style={s.input} placeholderTextColor={COLORS.textSecondary} value={editNombre} onChangeText={setEditNombre} />
          <View style={s.sheetBtns}>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setEditUser(null)}><Text style={s.sheetCancelText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[s.sheetOk, { backgroundColor: COLORS.accent }]} onPress={guardarNombre}><Text style={s.sheetOkText}>Guardar</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

// ─── Componentes pequeños ─────────────────────────────────────────────────────
const Stat = ({ n, label, color }: { n: number; label: string; color: string }) => (
  <View style={s.statCard}><Text style={[s.statNum, { color }]}>{n}</Text><Text style={s.statLabel}>{label}</Text></View>
);
const Badge = ({ text, color }: { text: string; color: string }) => (
  <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
    <Text style={[s.badgeText, { color }]}>{String(text).toUpperCase()}</Text>
  </View>
);
const Btn = ({ label, color, onPress, flex }: { label: string; color: string; onPress: () => void; flex?: boolean }) => (
  <TouchableOpacity style={[s.btn, { borderColor: color + '55', backgroundColor: color + '14' }, flex && { flex: 1 }]} onPress={onPress}>
    <Text style={[s.btnText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  hLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  hBtns: { flexDirection: 'row', gap: 6 },
  logoBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(46,204,113,0.2)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.4)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  hSub: { fontSize: 11, color: COLORS.textSecondary },
  hBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.05)' },
  hBtnText: { fontSize: 12, color: COLORS.accentLight, fontWeight: '500' },

  statsRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statCard: { flex: 1, backgroundColor: COLORS.inputBg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },

  tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.inputBg },
  tabOn: { backgroundColor: 'rgba(46,204,113,0.2)', borderColor: 'rgba(46,204,113,0.5)' },
  tabText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextOn: { color: COLORS.accentLight },

  errorBox: { margin: 16, marginBottom: 0, padding: 12, borderRadius: 10, backgroundColor: 'rgba(231,76,60,0.08)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.3)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  errorText: { flex: 1, fontSize: 12, color: COLORS.danger },
  retry: { fontSize: 12, color: COLORS.accentLight, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  muted: { fontSize: 14, color: COLORS.textSecondary },
  empty: { textAlign: 'center', color: COLORS.textSecondary, padding: 30, fontSize: 14 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBg },
  chipOn: { backgroundColor: 'rgba(46,204,113,0.2)', borderColor: 'rgba(46,204,113,0.5)' },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextOn: { color: COLORS.accentLight },

  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  zona: { fontSize: 13, color: COLORS.accentLight, marginBottom: 6 },
  desc: { fontSize: 14, color: COLORS.textPrimary, marginBottom: 8, lineHeight: 20 },
  meta: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  btn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 12, fontWeight: '600' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  section: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingBottom: 10 },
  blockBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(231,76,60,0.15)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.4)' },
  blockBtnText: { fontSize: 12, color: COLORS.danger, fontWeight: '700' },
  info: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(46,204,113,0.06)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)', borderRadius: 10, padding: 12 },
  infoText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logEmail: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  logEvento: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  bar: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 4 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: COLORS.border, padding: 20, paddingBottom: 40 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: COLORS.textPrimary, marginBottom: 16 },
  sheetError: { fontSize: 13, color: COLORS.danger, marginBottom: 12 },
  sheetBtns: { flexDirection: 'row', gap: 10 },
  sheetCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  sheetCancelText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  sheetOk: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.danger, alignItems: 'center' },
  sheetOkText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});