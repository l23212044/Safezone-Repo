import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const COLORS = {
  surface: '#0d1117',
  border: '#1e2530',
  accent: '#1a6bff',
  accentLight: '#7ab4ff',
  danger: '#ff3737',
  success: '#30e890',
  textPrimary: '#e0e8f0',
  textSecondary: '#8899aa',
  inputBg: '#111820',
};

const INCIDENT_TYPES = [
  { id: 'robo', label: '🔓 Robo' },
  { id: 'asalto', label: '⚠️ Asalto' },
  { id: 'accidente', label: '🚗 Accidente' },
  { id: 'violencia', label: '🚨 Violencia' },
  { id: 'sospechoso', label: '👁 Actividad sospechosa' },
  { id: 'otro', label: '📋 Otro' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  zoneName: string;
  zoneId: string;
  zoneLat: number;
  zoneLng: number;
}

export default function ReportModal({ visible, onClose, zoneName, zoneId, zoneLat, zoneLng }: Props) {
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setSelectedType('');
    setDescription('');
    setLoading(false);
    setSuccess(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedType) { setError('Selecciona el tipo de incidente.'); return; }
    if (!description.trim()) { setError('Describe brevemente el incidente.'); return; }
    setError('');
    setLoading(true);
    try {
      await addDoc(collection(db, 'reportes'), {
        tipo: selectedType,
        descripcion: description.trim(),
        zonaId: zoneId,
        zonaNombre: zoneName || 'Ubicación actual',
        lat: zoneLat,
        lng: zoneLng,
        usuarioId: auth.currentUser?.uid ?? 'anonimo',
        usuarioEmail: auth.currentUser?.email ?? 'anonimo',
        timestamp: serverTimestamp(),
        estado: 'pendiente',
      });
      setSuccess(true);
      setTimeout(handleClose, 2000);
    } catch {
      setError('Error al enviar. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Reportar incidente</Text>
              <Text style={styles.subtitle}>{zoneName || 'Ubicación actual'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>✓</Text>
                <View>
                  <Text style={styles.successTitle}>Reporte enviado</Text>
                  <Text style={styles.successSub}>Gracias por contribuir a la seguridad de Tijuana.</Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Tipo de incidente</Text>
                <View style={styles.typeGrid}>
                  {INCIDENT_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeBtn, selectedType === type.id && styles.typeBtnActive]}
                      onPress={() => setSelectedType(type.id)}
                    >
                      <Text style={[styles.typeBtnText, selectedType === type.id && styles.typeBtnTextActive]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.sectionLabel}>Descripción</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe brevemente lo que ocurrió..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{description.length}/300</Text>
                {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>⚠ {error}</Text></View>}
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>🔒 Tu reporte se envía de forma segura. Solo se registra tu ID de usuario, no tu nombre público.</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Enviar reporte</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: COLORS.border, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: COLORS.textSecondary },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBg },
  typeBtnActive: { backgroundColor: 'rgba(26,107,255,0.2)', borderColor: 'rgba(26,107,255,0.6)' },
  typeBtnText: { fontSize: 13, color: COLORS.textSecondary },
  typeBtnTextActive: { color: COLORS.accentLight, fontWeight: '600' },
  textArea: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.textPrimary, minHeight: 100, marginBottom: 6 },
  charCount: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginBottom: 16 },
  errorBox: { backgroundColor: 'rgba(255,55,55,0.08)', borderWidth: 1, borderColor: 'rgba(255,55,55,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: COLORS.danger },
  infoBox: { backgroundColor: 'rgba(26,107,255,0.06)', borderWidth: 1, borderColor: 'rgba(26,107,255,0.2)', borderRadius: 10, padding: 12, marginBottom: 20 },
  infoText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
  submitBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(48,232,144,0.08)', borderWidth: 1, borderColor: 'rgba(48,232,144,0.3)', borderRadius: 14, padding: 20, marginVertical: 20 },
  successIcon: { fontSize: 28, color: COLORS.success },
  successTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  successSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
});
