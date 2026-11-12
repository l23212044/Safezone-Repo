import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Platform, ScrollView, ActivityIndicator, Animated,
  Dimensions,
} from 'react-native';
import { apiFetch } from '../config/authService';

const { width: SCREEN_W } = Dimensions.get('window');

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
  cyan:          '#06b6d4',
  textPrimary:   '#FFFFFF',
  textSecondary: '#999999',
  inputBg:       '#1a1a1a',
};

// ── Stopwords en español ──────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'el','la','los','las','un','una','unos','unas','de','del','al','en','con',
  'por','para','que','se','me','mi','su','lo','le','les','nos','si','es',
  'era','fue','han','hay','he','yo','tu','él','a','o','e','y','pero','mas',
  'como','ya','no','muy','más','este','esta','esto','ese','esa','eso',
  'que','qué','quien','donde','cuando','como','cómo','dos','tres','vi','ver',
  'intentando','persona','personas','zona','lugar','cerca','estaba','había',
]);

// ── Categorías SEMÁNTICAS (por significado) ───────────────────────────────────
const SEMANTIC_GROUPS: Record<string, string[]> = {
  'Amenaza física':  ['golpear','golpe','amenaza','arma','pistola','cuchillo','violencia','pelea','ataque','agredir'],
  'Sustracción':     ['robar','robo','quitar','llevar','bolsa','celular','cartera','bicicleta','auto','carro'],
  'Presencia':       ['hombre','mujer','sujeto','individuo','grupo','joven','tipo','señor'],
  'Movimiento':      ['correr','huir','escapar','seguir','caminar','acercarse','entrar','salir'],
  'Lugar':           ['esquina','calle','avenida','mercado','estacionamiento','parque','tienda','casa'],
  'Tiempo':          ['noche','tarde','mañana','oscuro','madrugada','rapido','rato'],
};

// ── Categorías SINTÁCTICAS (por función gramatical) ───────────────────────────
// Sustantivos: personas, objetos, lugares, conceptos
const SUSTANTIVOS = new Set([
  'hombre','mujer','sujeto','individuo','grupo','joven','policia','victima','ladron','personas',
  'bolsa','celular','cartera','mochila','bicicleta','auto','carro','moto','arma','pistola','cuchillo',
  'calle','esquina','avenida','parque','tienda','casa','mercado','estacionamiento','colonia',
  'robo','asalto','golpe','amenaza','violencia','ataque','incidente','reporte',
  'noche','tarde','mañana','madrugada','hora','momento','rato',
]);
// Verbos: acciones y procesos
const VERBOS = new Set([
  'robar','asaltar','golpear','amenazar','correr','huir','escapar','seguir','caminar',
  'acercar','entrar','salir','intentar','gritar','pedir','tomar','quitar','llevar',
  'agredir','atacar','perseguir','vigilar','esperar','observar','reportar','ayudar',
]);
// Adjetivos: características y calificativos
const ADJETIVOS = new Set([
  'armado','peligroso','sospechoso','rapido','lento','solo','acompañado','oscuro',
  'desconocido','extraño','agresivo','nervioso','herido','masculino','femenino',
  'alto','bajo','delgado','gordo','joven','viejo','nuevo','viejo',
]);
// Adverbios: modo, tiempo, lugar
const ADVERBIOS = new Set([
  'rapidamente','lentamente','cerca','lejos','adentro','afuera','arriba','abajo',
  'antes','despues','mientras','siempre','nunca','ayer','hoy','aqui','alli',
  'aproximadamente','posiblemente','probablemente',
]);

function getSyntacticCategory(word: string): string {
  if (VERBOS.has(word))     return '🔵 Verbos (acción)';
  if (SUSTANTIVOS.has(word)) return '🟡 Sustantivos (entidad)';
  if (ADJETIVOS.has(word))  return '🟣 Adjetivos (calidad)';
  if (ADVERBIOS.has(word))  return '🟢 Adverbios (modo/lugar)';
  // Heurísticas morfológicas para palabras no en diccionario
  if (word.endsWith('ando') || word.endsWith('iendo') || word.endsWith('aron') ||
      word.endsWith('eron') || word.endsWith('aba')   || word.endsWith('aron'))
    return '🔵 Verbos (acción)';
  if (word.endsWith('mente'))
    return '🟢 Adverbios (modo/lugar)';
  if (word.endsWith('oso') || word.endsWith('osa') || word.endsWith('ado') || word.endsWith('ada'))
    return '🟣 Adjetivos (calidad)';
  return '🟡 Sustantivos (entidad)'; // default: sustantivo
}

interface Reporte {
  id: string;
  tipo: string;
  descripcion: string;
  zonaNombre: string;
  timestamp?: any;
}

interface TreeNode {
  id: string;
  label: string;
  count: number;
  color: string;
  children: TreeNode[];
  expanded: boolean;
  depth: number;
}

// ── Funciones de análisis ─────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

function getSemanticGroup(word: string): string | null {
  for (const [group, keywords] of Object.entries(SEMANTIC_GROUPS)) {
    if (keywords.some(k => word.includes(k) || k.includes(word))) return group;
  }
  return null;
}

const TIPO_COLORS: Record<string, string> = {
  robo:       COLORS.danger,
  asalto:     COLORS.warning,
  accidente:  COLORS.cyan,
  violencia:  '#f97316',
  sospechoso: COLORS.purple,
  otro:       COLORS.textSecondary,
};

const SYNT_COLORS: Record<string, string> = {
  '🔵 Verbos (acción)':      '#3b82f6',
  '🟡 Sustantivos (entidad)':'#eab308',
  '🟣 Adjetivos (calidad)':  '#a855f7',
  '🟢 Adverbios (modo/lugar)':'#27AE60',
};

// ── Árbol SEMÁNTICO: Raíz → Tipo → Zona → CategoríaSignificado → Lexema ──────
function buildSemanticTree(reportes: Reporte[]): TreeNode {
  const porTipo: Record<string, Reporte[]> = {};
  reportes.forEach(r => {
    const t = r.tipo || 'otro';
    if (!porTipo[t]) porTipo[t] = [];
    porTipo[t].push(r);
  });

  const tipoNodes: TreeNode[] = Object.entries(porTipo).map(([tipo, reps]) => {
    const porZona: Record<string, Reporte[]> = {};
    reps.forEach(r => {
      const z = r.zonaNombre || 'Desconocida';
      if (!porZona[z]) porZona[z] = [];
      porZona[z].push(r);
    });

    const zonaNodes: TreeNode[] = Object.entries(porZona).map(([zona, zReps]) => {
      const wordFreq: Record<string, number> = {};
      zReps.forEach(r => {
        tokenize(r.descripcion || '').forEach(w => {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
      });

      // Nivel 3: categorías SEMÁNTICAS (por significado/campo léxico)
      const semGroups: Record<string, string[]> = {};
      Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([word]) => {
          const group = (() => {
            for (const [g, kws] of Object.entries(SEMANTIC_GROUPS)) {
              if (kws.some(k => word.includes(k) || k.includes(word))) return g;
            }
            return 'Campo general';
          })();
          if (!semGroups[group]) semGroups[group] = [];
          semGroups[group].push(word);
        });

      const kwNodes: TreeNode[] = Object.entries(semGroups).map(([group, words]) => ({
        id: `sem-${tipo}-${zona}-${group}`,
        label: group,
        count: words.length,
        color: COLORS.accentLight,
        expanded: false,
        depth: 3,
        children: words.slice(0, 6).map(w => ({
          id: `sem-${tipo}-${zona}-${group}-${w}`,
          label: w,
          count: wordFreq[w],
          color: COLORS.textSecondary,
          expanded: false,
          depth: 4,
          children: [],
        })),
      }));

      return { id:`sem-${tipo}-${zona}`, label:zona, count:zReps.length, color:COLORS.success, expanded:false, depth:2, children:kwNodes };
    });

    return { id:`sem-${tipo}`, label:tipo.charAt(0).toUpperCase()+tipo.slice(1), count:reps.length, color:TIPO_COLORS[tipo]??COLORS.textSecondary, expanded:false, depth:1, children:zonaNodes };
  });

  return { id:'sem-root', label:'🧠 Árbol Semántico', count:reportes.length, color:COLORS.accent, expanded:true, depth:0, children:tipoNodes };
}

// ── Árbol SINTÁCTICO: Raíz → CategoríaGramatical → Tipo → Lexema+frec ────────
// Estructura diferente: el nivel 1 son las clases de palabras (no el tipo de incidente)
function buildSyntacticTree(reportes: Reporte[]): TreeNode {
  // Recolectar todas las palabras con su tipo de incidente y frecuencia
  const catWords: Record<string, Record<string, { freq: number; tipos: Set<string> }>> = {};

  reportes.forEach(r => {
    const tipo = r.tipo || 'otro';
    tokenize(r.descripcion || '').forEach(w => {
      const cat = getSyntacticCategory(w);
      if (!catWords[cat]) catWords[cat] = {};
      if (!catWords[cat][w]) catWords[cat][w] = { freq: 0, tipos: new Set() };
      catWords[cat][w].freq++;
      catWords[cat][w].tipos.add(tipo);
    });
  });

  // Nivel 1: Clase gramatical
  const catNodes: TreeNode[] = Object.entries(catWords)
    .sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)
    .map(([cat, words]) => {

      // Nivel 2: Subgrupo por tipo de incidente donde aparece la palabra
      const porTipoIncidente: Record<string, string[]> = {};
      Object.entries(words)
        .sort((a, b) => b[1].freq - a[1].freq)
        .slice(0, 24)
        .forEach(([w, info]) => {
          info.tipos.forEach(t => {
            if (!porTipoIncidente[t]) porTipoIncidente[t] = [];
            porTipoIncidente[t].push(w);
          });
        });

      const tipoNodes: TreeNode[] = Object.entries(porTipoIncidente).map(([tipo, ws]) => ({
        id: `synt-${cat}-${tipo}`,
        label: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        count: ws.length,
        color: TIPO_COLORS[tipo] ?? COLORS.textSecondary,
        expanded: false,
        depth: 2,
        // Nivel 3: lexemas individuales con frecuencia
        children: ws.slice(0, 8).map(w => ({
          id: `synt-${cat}-${tipo}-${w}`,
          label: w,
          count: words[w]?.freq ?? 1,
          color: SYNT_COLORS[cat] ?? COLORS.textSecondary,
          expanded: false,
          depth: 3,
          children: [],
        })),
      }));

      return {
        id: `synt-${cat}`,
        label: cat,
        count: Object.keys(words).length,
        color: SYNT_COLORS[cat] ?? COLORS.accentLight,
        expanded: false,
        depth: 1,
        children: tipoNodes,
      };
    });

  return { id:'synt-root', label:'🔤 Árbol Sintáctico', count:reportes.length, color:'#06b6d4', expanded:true, depth:0, children:catNodes };
}

// ── Componente nodo ───────────────────────────────────────────────────────────
interface NodeProps {
  node: TreeNode;
  onToggle: (id: string) => void;
  isLast: boolean;
}

function TreeNodeView({ node, onToggle, isLast }: NodeProps) {
  const anim = useRef(new Animated.Value(node.expanded ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: node.expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [node.expanded]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    if (node.children.length > 0) onToggle(node.id);
  };

  const indent = node.depth * 18;
  const hasChildren = node.children.length > 0;

  const nodeSize = node.depth === 0 ? 14 : node.depth === 1 ? 11 : node.depth === 2 ? 9 : 7;
  const fontSize = node.depth === 0 ? 15 : node.depth === 1 ? 14 : node.depth === 2 ? 13 : 12;

  return (
    <View>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.nodeRow, { paddingLeft: 16 + indent }]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          {/* Conector vertical */}
          {node.depth > 0 && (
            <View style={[styles.connector, { left: 16 + indent - 14 }]} />
          )}

          {/* Línea horizontal */}
          {node.depth > 0 && (
            <View style={[styles.hLine, { left: 16 + indent - 14, width: 14 }]} />
          )}

          {/* Botón expand/collapse */}
          {hasChildren ? (
            <View style={[styles.expandBtn, { borderColor: node.color + '80', backgroundColor: node.color + '18' }]}>
              <Text style={[styles.expandIcon, { color: node.color, fontSize: 10 }]}>
                {node.expanded ? '−' : '+'}
              </Text>
            </View>
          ) : (
            <View style={[styles.leafDot, { backgroundColor: node.color, width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 }]} />
          )}

          {/* Label */}
          <View style={styles.nodeLabelWrap}>
            <Text style={[styles.nodeLabel, { fontSize, color: node.depth === 0 ? COLORS.textPrimary : node.depth >= 3 ? COLORS.textSecondary : COLORS.textPrimary }]}
              numberOfLines={1}
            >
              {node.label}
            </Text>
            {node.count > 0 && (
              <View style={[styles.countBadge, { backgroundColor: node.color + '22', borderColor: node.color + '55' }]}>
                <Text style={[styles.countText, { color: node.color }]}>{node.count}</Text>
              </View>
            )}
          </View>

          {/* Categoría semántica tag */}
          {node.depth === 3 && (
            <View style={styles.semTag}>
              <Text style={styles.semTagText}>SEM</Text>
            </View>
          )}
          {node.depth === 1 && (
            <View style={[styles.semTag, { backgroundColor: node.color + '20', borderColor: node.color + '50' }]}>
              <Text style={[styles.semTagText, { color: node.color }]}>TIPO</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Children */}
      {node.expanded && node.children.length > 0 && (
        <View style={[styles.childrenWrap, { borderLeftColor: node.color + '30', borderLeftWidth: 1, marginLeft: 16 + indent + 8 }]}>
          {node.children.map((child, i) => (
            <TreeNodeView
              key={child.id}
              node={child}
              onToggle={onToggle}
              isLast={i === node.children.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function TreeScreen({ navigation }: any) {
  const [loading, setLoading]   = useState(true);
  const [tree, setTree]         = useState<TreeNode | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [mode, setMode]         = useState<'semantico' | 'sintactico'>('semantico');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchReportes(); }, []);

  // Reconstruir árbol cuando cambia el modo
  useEffect(() => {
    if (reportes.length === 0) return;
    fadeAnim.setValue(0);
    const built = mode === 'semantico'
      ? buildSemanticTree(reportes)
      : buildSyntacticTree(reportes);
    setTree(built);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [mode, reportes]);

  const fetchReportes = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch('/reportes');
      const data: Reporte[] = rows.map((r: any) => ({
        id: String(r.id),
        tipo: r.tipo ?? 'otro',
        descripcion: r.descripcion ?? '',
        zonaNombre: r.zona ?? 'Desconocida',
        timestamp: r.creado_en,
      }));
      setReportes(data);
      const built = buildSemanticTree(data);
      setTree(built);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle nodo en el árbol (inmutable update)
  const toggleNode = (targetId: string) => {
    if (!tree) return;

    const toggle = (node: TreeNode): TreeNode => {
      if (node.id === targetId) return { ...node, expanded: !node.expanded };
      return { ...node, children: node.children.map(toggle) };
    };
    setTree(toggle(tree));
  };

  // Expandir / colapsar todo
  const setAllExpanded = (val: boolean) => {
    if (!tree) return;
    const setExp = (node: TreeNode): TreeNode => ({
      ...node,
      expanded: val,
      children: node.children.map(setExp),
    });
    setTree(setExp(tree));
  };

  // Stats rápidas
  const totalWords = reportes.reduce((acc, r) => acc + tokenize(r.descripcion || '').length, 0);
  const uniqueWords = new Set(reportes.flatMap(r => tokenize(r.descripcion || ''))).size;
  const avgWords = reportes.length ? Math.round(totalWords / reportes.length) : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Árbol Lingüístico</Text>
          <Text style={styles.headerSub}>Análisis de descripciones · {reportes.length} reportes</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchReportes}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Selector semántico / sintáctico */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'semantico' && styles.modeBtnActive]}
          onPress={() => setMode('semantico')}
        >
          <Text style={[styles.modeBtnText, mode === 'semantico' && styles.modeBtnTextActive]}>
            🧠 Semántico
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'sintactico' && styles.modeBtnActive]}
          onPress={() => setMode('sintactico')}
        >
          <Text style={[styles.modeBtnText, mode === 'sintactico' && styles.modeBtnTextActive]}>
            🔤 Sintáctico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info del modo */}
      <View style={styles.modeInfoBox}>
        <Text style={styles.modeInfoText}>
          {mode === 'semantico'
            ? '🧠 Semántico: Raíz → Tipo de incidente → Zona → Campo léxico (amenaza, lugar, tiempo...) → Lexema'
            : '🔤 Sintáctico: Raíz → Clase gramatical (verbo/sustantivo/adj.) → Tipo de incidente → Lexema con frecuencia'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.loadingText}>Analizando descripciones...</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: COLORS.accent }]}>{totalWords}</Text>
              <Text style={styles.statLabel}>Tokens</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: COLORS.purple }]}>{uniqueWords}</Text>
              <Text style={styles.statLabel}>Únicos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: COLORS.success }]}>{avgWords}</Text>
              <Text style={styles.statLabel}>Prom/rep.</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: COLORS.warning }]}>{tree?.children.length ?? 0}</Text>
              <Text style={styles.statLabel}>Categorías</Text>
            </View>
          </View>

          {/* Controles árbol */}
          <View style={styles.treeControls}>
            <Text style={styles.treeControlsLabel}>Vista del árbol</Text>
            <View style={styles.treeControlsBtns}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => setAllExpanded(true)}>
                <Text style={styles.ctrlBtnText}>Expandir todo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => setAllExpanded(false)}>
                <Text style={styles.ctrlBtnText}>Colapsar todo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Leyenda dinámica según modo */}
          <View style={styles.legend}>
            {mode === 'semantico' ? (
              <>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.accent}]}/><Text style={styles.legendText}>Raíz</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.danger}]}/><Text style={styles.legendText}>Tipo incidente</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.success}]}/><Text style={styles.legendText}>Zona</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.accentLight}]}/><Text style={styles.legendText}>Campo léxico</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.textSecondary}]}/><Text style={styles.legendText}>Lexema</Text></View>
              </>
            ) : (
              <>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#06b6d4'}]}/><Text style={styles.legendText}>Raíz</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#3b82f6'}]}/><Text style={styles.legendText}>Verbos</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:'#eab308'}]}/><Text style={styles.legendText}>Sustantivos</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.purple}]}/><Text style={styles.legendText}>Adjetivos</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:COLORS.success}]}/><Text style={styles.legendText}>Adverbios</Text></View>
              </>
            )}
          </View>

          {/* Árbol */}
          <ScrollView
            style={styles.treeScroll}
            showsVerticalScrollIndicator={false}
            horizontal={false}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.treeWrap}>
                {tree && (
                  <TreeNodeView
                    node={tree}
                    onToggle={toggleNode}
                    isLast={true}
                  />
                )}
              </View>
            </ScrollView>
            <View style={{ height: 60 }} />
          </ScrollView>

        </Animated.View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: COLORS.textPrimary },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  headerSub:    { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: { fontSize: 18, color: COLORS.accentLight },

  modeRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(46,204,113,0.2)',
    borderColor: 'rgba(46,204,113,0.6)',
  },
  modeBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  modeBtnTextActive: { color: COLORS.accentLight },

  modeInfoBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: 'rgba(46,204,113,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.15)',
    borderRadius: 10,
    padding: 10,
  },
  modeInfoText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: 'center',
  },
  statNum:   { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },

  treeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  treeControlsLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  treeControlsBtns:  { flexDirection: 'row', gap: 8 },
  ctrlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
  },
  ctrlBtnText: { fontSize: 11, color: COLORS.accentLight, fontWeight: '600' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textSecondary },

  treeScroll: { flex: 1 },
  treeWrap: {
    paddingVertical: 8,
    paddingRight: 32,
    minWidth: SCREEN_W,
  },

  // Nodo
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingRight: 12,
    gap: 8,
  },
  connector: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.border,
  },
  hLine: {
    position: 'absolute',
    top: '50%',
    height: 1,
    backgroundColor: COLORS.border,
  },
  expandBtn: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: { fontWeight: '700', lineHeight: 14 },
  leafDot: {},

  nodeLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  nodeLabel: { fontWeight: '500', letterSpacing: 0.2, flexShrink: 1 },

  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  countText: { fontSize: 10, fontWeight: '700' },

  semTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  semTagText: { fontSize: 9, fontWeight: '700', color: COLORS.purple, letterSpacing: 0.5 },

  childrenWrap: {
    paddingLeft: 0,
  },
});