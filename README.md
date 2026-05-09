# SafeZone

Aplicación móvil Expo/React Native para visualizar zonas de riesgo en Tijuana, registrar incidentes con Firebase y consultar una ponderación mensual de riesgo por delegación.

## Estructura

```text
.expo/
assets/
src/
  components/
    ReportModal.tsx
  config/
    firebase.ts
    riskEngine.ts
  navigation/
    AppNavigator.tsx
  screens/
    AdminScreen.tsx
    LoginScreen.tsx
    MapScreen.tsx
    ReportScreen.tsx
    RiskDashboard.tsx
    TreeScreen.tsx
App.tsx
index.ts
package.json
tsconfig.json
```

## Configuración

Define las variables `EXPO_PUBLIC_FIREBASE_*` y `EXPO_PUBLIC_ADMIN_CODE` en tu entorno o reemplaza los placeholders de `src/config/firebase.ts`.

## Scripts

- `npm start`: inicia Expo.
- `npm run android`: abre en Android.
- `npm run ios`: abre en iOS.
- `npm run web`: abre en web.
- `npm run typecheck`: ejecuta TypeScript sin emitir archivos.
