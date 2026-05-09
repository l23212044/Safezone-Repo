import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ADMIN_CODE, auth } from '../config/firebase';

const { height } = Dimensions.get('window');
const COLORS = {
  bg: '#07090f', surface: '#0d1117', border: '#1e2530', borderFocus: '#1a6bff', accent: '#1a6bff', accentLight: '#7ab4ff', success: '#30e890', danger: '#ff3737', textPrimary: '#e0e8f0', textSecondary: '#8899aa', inputBg: '#111820',
};

interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  secureTextEntry?: boolean;
}

function InputField({ label, placeholder, value, onChangeText, keyboardType = 'default', autoCapitalize = 'none', secureTextEntry }: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, focused && styles.inputFocused]} placeholder={placeholder} placeholderTextColor={COLORS.textSecondary} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} secureTextEntry={secureTextEntry} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    </View>
  );
}

export default function LoginScreen({ navigation }: any) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setError('');
    Animated.timing(tabAnim, { toValue: t === 'login' ? 0 : 1, duration: 220, useNativeDriver: false }).start();
  };
  const tabIndicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '52%'] });

  const validate = () => {
    if (!email.trim()) return 'El correo es requerido.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Correo inválido.';
    if (password.length < 6) return 'Mínimo 6 caracteres.';
    if (isAdmin && adminCode !== ADMIN_CODE) return 'Código de administrador incorrecto.';
    if (tab === 'register' && !name.trim()) return 'El nombre es requerido.';
    if (tab === 'register' && !studentId.trim()) return 'La matrícula es requerida.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(''); setLoading(true);
    try {
      if (tab === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        navigation.replace(isAdmin ? 'Admin' : 'Map');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        navigation.replace('Map');
      }
    } catch (e: any) {
      const firebaseErrors: Record<string, string> = {
        'auth/user-not-found': 'No existe cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Ese correo ya está registrado.',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
        'auth/network-request-failed': 'Sin conexión a internet.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      };
      setError(firebaseErrors[e.code] ?? 'Error inesperado. Intenta de nuevo.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <LinearGradient colors={['rgba(0,100,255,0.06)', 'transparent']} style={styles.ambientGlow} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}><View style={styles.logoBox}><Text style={styles.logoText}>SZ</Text></View><View><Text style={styles.appName}>SAFEZONE</Text><Text style={styles.appTagline}>Seguridad inteligente · Tijuana</Text></View></View>
          <View style={styles.card}>
            <View style={styles.tabContainer}><Animated.View style={[styles.tabIndicator, { left: tabIndicatorLeft }]} /><TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('login')}><Text style={[styles.tabLabel, tab === 'login' && styles.tabLabelActive]}>Iniciar sesión</Text></TouchableOpacity><TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('register')}><Text style={[styles.tabLabel, tab === 'register' && styles.tabLabelActive]}>Registrarse</Text></TouchableOpacity></View>
            {tab === 'register' && <><InputField label="Nombre completo" placeholder="Ricardo A. Pineda" value={name} onChangeText={setName} autoCapitalize="words" /><InputField label="Matrícula" placeholder="23212031" value={studentId} onChangeText={setStudentId} keyboardType="numeric" /></>}
            <InputField label="Correo institucional" placeholder="usuario@tectijuana.edu.mx" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>Contraseña</Text><View style={styles.passRow}><TextInput style={[styles.input, styles.inputPass]} placeholder="••••••••" placeholderTextColor={COLORS.textSecondary} value={password} onChangeText={setPassword} secureTextEntry={!showPass} autoCapitalize="none" /><TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}><Text style={styles.eyeText}>{showPass ? '🙈' : '👁'}</Text></TouchableOpacity></View></View>
            {tab === 'login' && <TouchableOpacity style={styles.forgotRow}><Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text></TouchableOpacity>}
            {!!error && <View style={[styles.feedbackBox, styles.feedbackError]}><Text style={styles.feedbackIcon}>⚠</Text><Text style={styles.feedbackText}>{error}</Text></View>}
            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}><LinearGradient colors={['#1a6bff', '#0f4fc2']} style={styles.submitGradient}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>{tab === 'login' ? 'Acceder a SafeZone' : 'Crear cuenta'}</Text>}</LinearGradient></TouchableOpacity>
            <TouchableOpacity style={styles.adminToggle} onPress={() => { setIsAdmin(v => !v); setAdminCode(''); }}><Text style={styles.adminToggleText}>{isAdmin ? '👤 Acceso normal' : '🛡 Acceso administrador'}</Text></TouchableOpacity>
            {isAdmin && <InputField label="Código de administrador" placeholder="SZ-XXXX-XXXX" value={adminCode} onChangeText={setAdminCode} />}
          </View>
          <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>o continúa con</Text><View style={styles.dividerLine} /></View>
          <TouchableOpacity style={styles.googleBtn}><Text style={styles.googleBtnText}>🔑  Google (TecNM)</Text></TouchableOpacity>
          <View style={styles.securityBadge}><Text style={styles.securityText}>🔒  Conexión cifrada · 2FA disponible</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg }, flex: { flex: 1 }, ambientGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.6, opacity: 0.8 }, scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32, alignSelf: 'center' }, logoBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' }, logoText: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 1 }, appName: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 3 }, appTagline: { fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.5, marginTop: 2 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 24, marginBottom: 20 }, tabContainer: { flexDirection: 'row', backgroundColor: '#111820', borderRadius: 12, padding: 4, marginBottom: 24, position: 'relative', height: 44 }, tabIndicator: { position: 'absolute', top: 4, width: '46%', height: 36, backgroundColor: 'rgba(26,107,255,0.25)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(26,107,255,0.5)' }, tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }, tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.3 }, tabLabelActive: { color: COLORS.accentLight },
  fieldWrap: { marginBottom: 16 }, fieldLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase' }, input: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.textPrimary }, inputFocused: { borderColor: COLORS.borderFocus }, passRow: { flexDirection: 'row', alignItems: 'center' }, inputPass: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }, eyeBtn: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderLeftWidth: 0, borderColor: COLORS.border, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 14 }, eyeText: { fontSize: 16 }, forgotRow: { alignItems: 'flex-end', marginBottom: 16, marginTop: -8 }, forgotText: { fontSize: 13, color: COLORS.accentLight },
  feedbackBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 }, feedbackError: { backgroundColor: 'rgba(255,55,55,0.08)', borderColor: 'rgba(255,55,55,0.3)' }, feedbackIcon: { fontSize: 14, color: COLORS.textPrimary }, feedbackText: { fontSize: 13, color: COLORS.textPrimary, flex: 1 }, submitBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 }, submitBtnDisabled: { opacity: 0.6 }, submitGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }, submitLabel: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 }, adminToggle: { alignItems: 'center', paddingVertical: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(26,107,255,0.3)', backgroundColor: 'rgba(26,107,255,0.06)' }, adminToggleText: { fontSize: 13, color: COLORS.accentLight, fontWeight: '600', letterSpacing: 0.3 }, dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }, dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border }, dividerText: { fontSize: 12, color: COLORS.textSecondary }, googleBtn: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 24 }, googleBtnText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' }, securityBadge: { alignItems: 'center' }, securityText: { fontSize: 12, color: COLORS.textSecondary },
});
