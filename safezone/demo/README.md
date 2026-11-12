# SafeZone Demo (offline)

APK de demostración de SafeZone con datos simulados. No requiere API ni conexión a MySQL: los reportes, usuarios, índice de riesgo y panel de administración funcionan localmente.

## Descarga

- Archivo: `SafeZone-Demo.apk`
- GitHub Release: https://github.com/l23212044/Safezone-Repo/releases/tag/v1.0.0-demo
- Build EAS: https://expo.dev/accounts/zerorone/projects/safezone/builds/c63eaf09-7c53-4717-91ea-62bbd6640dbd
- SHA-256: `0de34ba38b9eda8e6f2a7d9abaf6f09c8654ff1d5c5854a7141af80a5b821c18`

## Credenciales

| Rol | Correo | Contraseña | Código admin |
| --- | --- | --- | --- |
| Ciudadano | `demo@safezone.mx` | `demo1234` | — |
| Administrador | `admin@safezone.mx` | `admin1234` | `SZ-DEMO-2026` |

Para entrar al panel de administración activa la opción de administrador en el login e ingresa el código `SZ-DEMO-2026`.

## Instalación

1. Descarga `SafeZone-Demo.apk` en un dispositivo Android.
2. Habilita la instalación de aplicaciones de origen desconocido para el navegador o gestor de archivos.
3. Abre el APK e instala.
4. Inicia sesión con una de las credenciales de la tabla.

## Notas

- El APK se compiló con `EXPO_PUBLIC_DEMO_MODE=true` y el perfil `demo` de `eas.json`.
- Los datos simulados viven en `src/config/demoService.ts` y no se envían a ningún servidor.
- Para regenerar el APK:

```bash
cd safezone
npm install
npm run demo:build
```
