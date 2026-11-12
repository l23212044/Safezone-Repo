/**
 * SafeZone – Servicio de demostración offline.
 * Simula las respuestas de safezone-api con datos locales creíbles.
 * Solo se usa cuando EXPO_PUBLIC_DEMO_MODE=true.
 */
import { DEMO_CODE } from './demoMode';

declare const process: { env: Record<string, string | undefined> };

type Rol = 'ciudadano' | 'admin';
type EstadoReporte = 'activo' | 'revisado' | 'archivado' | 'rechazado';

interface DemoUser {
  id: number;
  email: string;
  nombre: string;
  matricula?: string | null;
  password: string;
  rol: Rol;
  estado: 'activo' | 'suspendido' | 'inactivo';
  creado_en: string;
}

interface DemoReporte {
  id: number;
  delegacion_id: number;
  zona: string;
  tipo: string;
  peso_capturado: number;
  descripcion: string;
  estado: EstadoReporte;
  eliminado: 0 | 1;
  creado_en: string;
  usuario: string;
}

interface DemoZone {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  base: number;
}

const iso = (daysAgo = 0, hoursAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();

const periodStart = (() => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
})();

const zonas: DemoZone[] = [
  { id: 1, nombre: 'Centro',                    lat: 32.5149, lng: -117.0382, base: 65 },
  { id: 2, nombre: 'La Mesa',                   lat: 32.7200, lng: -117.0200, base: 35 },
  { id: 3, nombre: 'Otay-Centenario',           lat: 32.5500, lng: -116.9200, base: 70 },
  { id: 4, nombre: 'Playas de Tijuana',         lat: 32.5300, lng: -117.1200, base: 8 },
  { id: 5, nombre: 'San Antonio de los Buenos', lat: 32.4950, lng: -117.0650, base: 12 },
  { id: 6, nombre: 'Sánchez Taboada',           lat: 32.5050, lng: -116.9900, base: 30 },
  { id: 7, nombre: 'Cerro Colorado',            lat: 32.5400, lng: -116.9700, base: 32 },
  { id: 8, nombre: 'La Presa',                  lat: 32.5600, lng: -116.8900, base: 60 },
  { id: 9, nombre: 'La Presa Este',             lat: 32.5200, lng: -116.8600, base: 40 },
];

const usuarios: DemoUser[] = [
  { id: 1, email: 'demo@safezone.mx', nombre: 'Usuario Demo', matricula: '23212031', password: 'demo1234', rol: 'ciudadano', estado: 'activo', creado_en: iso(40) },
  { id: 2, email: 'admin@safezone.mx', nombre: 'Administrador SafeZone', matricula: '23212044', password: 'admin1234', rol: 'admin', estado: 'activo', creado_en: iso(60) },
  { id: 3, email: 'maria.lopez@tectijuana.edu.mx', nombre: 'María López', matricula: '23212018', password: 'demo1234', rol: 'ciudadano', estado: 'activo', creado_en: iso(22) },
  { id: 4, email: 'jorge.ramirez@tectijuana.edu.mx', nombre: 'Jorge Ramírez', matricula: '23212077', password: 'demo1234', rol: 'ciudadano', estado: 'activo', creado_en: iso(15) },
  { id: 5, email: 'ana.torres@tectijuana.edu.mx', nombre: 'Ana Torres', matricula: '23212052', password: 'demo1234', rol: 'ciudadano', estado: 'suspendido', creado_en: iso(9) },
];

let currentUser: DemoUser | null = null;

let reportes: DemoReporte[] = [
  { id: 1,  delegacion_id: 1, zona: 'Centro', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Dos personas rompieron la ventanilla de un auto estacionado sobre la avenida Revolución.', estado: 'activo', eliminado: 0, creado_en: iso(0, 2), usuario: 'demo@safezone.mx' },
  { id: 2,  delegacion_id: 1, zona: 'Centro', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Asalto a mano armada cerca de la esquina de la calle Tercera y Madero.', estado: 'activo', eliminado: 0, creado_en: iso(0, 5), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 3,  delegacion_id: 1, zona: 'Centro', tipo: 'Robo con violencia', peso_capturado: 2, descripcion: 'Intentaron quitarle la mochila a una estudiante al salir del transporte público.', estado: 'activo', eliminado: 0, creado_en: iso(1, 1), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 4,  delegacion_id: 1, zona: 'Centro', tipo: 'Homicidio', peso_capturado: 4, descripcion: 'Reportan una riña con detonaciones de arma de fuego cerca de la zona centro.', estado: 'activo', eliminado: 0, creado_en: iso(1, 6), usuario: 'demo@safezone.mx' },
  { id: 5,  delegacion_id: 1, zona: 'Centro', tipo: 'Actividad sospechosa', peso_capturado: 1, descripcion: 'Un sujeto vigila la entrada de una tienda y sigue a las personas que salen.', estado: 'revisado', eliminado: 0, creado_en: iso(2, 3), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 6,  delegacion_id: 2, zona: 'La Mesa', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Robo de bicicleta afuera de un supermercado en la colonia La Mesa.', estado: 'activo', eliminado: 0, creado_en: iso(0, 7), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 7,  delegacion_id: 2, zona: 'La Mesa', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Asalto a un conductor mientras esperaba el semáforo sobre la avenida Principal.', estado: 'activo', eliminado: 0, creado_en: iso(1, 2), usuario: 'demo@safezone.mx' },
  { id: 8,  delegacion_id: 2, zona: 'La Mesa', tipo: 'Actividad sospechosa', peso_capturado: 1, descripcion: 'Vehículo sin placas da vueltas por la misma cuadra durante varios minutos.', estado: 'activo', eliminado: 0, creado_en: iso(2, 8), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 9,  delegacion_id: 2, zona: 'La Mesa', tipo: 'Accidente / choque', peso_capturado: 0.5, descripcion: 'Choque menor entre dos autos en el cruce de la avenida La Mesa.', estado: 'activo', eliminado: 0, creado_en: iso(3, 1), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 10, delegacion_id: 3, zona: 'Otay-Centenario', tipo: 'Homicidio', peso_capturado: 4, descripcion: 'Hallazgo de una persona lesionada en un lote cercano al cruce fronterizo.', estado: 'activo', eliminado: 0, creado_en: iso(0, 4), usuario: 'demo@safezone.mx' },
  { id: 11, delegacion_id: 3, zona: 'Otay-Centenario', tipo: 'Robo con violencia', peso_capturado: 2, descripcion: 'Robaron equipaje a una familia que salía de la garita de Otay.', estado: 'activo', eliminado: 0, creado_en: iso(1, 4), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 12, delegacion_id: 3, zona: 'Otay-Centenario', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Asalto en un estacionamiento de la zona industrial.', estado: 'activo', eliminado: 0, creado_en: iso(2, 5), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 13, delegacion_id: 4, zona: 'Playas de Tijuana', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Robo de pertenencias en la playa mientras el grupo estaba en el agua.', estado: 'activo', eliminado: 0, creado_en: iso(0, 9), usuario: 'demo@safezone.mx' },
  { id: 14, delegacion_id: 4, zona: 'Playas de Tijuana', tipo: 'Actividad sospechosa', peso_capturado: 1, descripcion: 'Persona tomando fotos a los vehículos estacionados cerca del malecón.', estado: 'activo', eliminado: 0, creado_en: iso(2, 1), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 15, delegacion_id: 5, zona: 'San Antonio de los Buenos', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Robo de herramientas de una camioneta en una zona residencial.', estado: 'activo', eliminado: 0, creado_en: iso(1, 8), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 16, delegacion_id: 5, zona: 'San Antonio de los Buenos', tipo: 'Accidente / choque', peso_capturado: 0.5, descripcion: 'Motociclista derrapó en la avenida principal después de la lluvia.', estado: 'activo', eliminado: 0, creado_en: iso(3, 2), usuario: 'demo@safezone.mx' },
  { id: 17, delegacion_id: 6, zona: 'Sánchez Taboada', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Robo a un local comercial durante la madrugada.', estado: 'activo', eliminado: 0, creado_en: iso(0, 10), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 18, delegacion_id: 6, zona: 'Sánchez Taboada', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Dos sujetos armados asaltaron una tienda de conveniencia.', estado: 'activo', eliminado: 0, creado_en: iso(1, 3), usuario: 'demo@safezone.mx' },
  { id: 19, delegacion_id: 6, zona: 'Sánchez Taboada', tipo: 'Actividad sospechosa', peso_capturado: 1, descripcion: 'Personas desconocidas merodean los estacionamientos por las noches.', estado: 'revisado', eliminado: 0, creado_en: iso(2, 7), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 20, delegacion_id: 7, zona: 'Cerro Colorado', tipo: 'Robo con violencia', peso_capturado: 2, descripcion: 'Robo con violencia a una persona que caminaba sola por la noche.', estado: 'activo', eliminado: 0, creado_en: iso(0, 6), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 21, delegacion_id: 7, zona: 'Cerro Colorado', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Robo de celular en una parada de autobús.', estado: 'activo', eliminado: 0, creado_en: iso(1, 5), usuario: 'demo@safezone.mx' },
  { id: 22, delegacion_id: 7, zona: 'Cerro Colorado', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Asalto a un repartidor en la entrada de un fraccionamiento.', estado: 'activo', eliminado: 0, creado_en: iso(2, 2), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 23, delegacion_id: 8, zona: 'La Presa', tipo: 'Homicidio', peso_capturado: 4, descripcion: 'Reportan detonaciones y una persona herida en la vía pública.', estado: 'activo', eliminado: 0, creado_en: iso(0, 3), usuario: 'demo@safezone.mx' },
  { id: 24, delegacion_id: 8, zona: 'La Presa', tipo: 'Robo con violencia', peso_capturado: 2, descripcion: 'Asalto a pasajeros de un transporte público.', estado: 'activo', eliminado: 0, creado_en: iso(1, 7), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 25, delegacion_id: 8, zona: 'La Presa', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Asalto a una tienda de abarrotes por dos sujetos armados.', estado: 'activo', eliminado: 0, creado_en: iso(2, 4), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
  { id: 26, delegacion_id: 9, zona: 'La Presa Este', tipo: 'Robo', peso_capturado: 1.5, descripcion: 'Robo de una motocicleta estacionada frente a una vivienda.', estado: 'activo', eliminado: 0, creado_en: iso(0, 8), usuario: 'demo@safezone.mx' },
  { id: 27, delegacion_id: 9, zona: 'La Presa Este', tipo: 'Asalto armado', peso_capturado: 2, descripcion: 'Asalto a transeúntes en el camino a La Presa.', estado: 'activo', eliminado: 0, creado_en: iso(1, 9), usuario: 'maria.lopez@tectijuana.edu.mx' },
  { id: 28, delegacion_id: 9, zona: 'La Presa Este', tipo: 'Accidente / choque', peso_capturado: 0.5, descripcion: 'Choque por alcance en la carretera rumbo a La Presa.', estado: 'activo', eliminado: 0, creado_en: iso(3, 3), usuario: 'jorge.ramirez@tectijuana.edu.mx' },
];

const bloquearon: { email: string; motivo: string; fecha: string }[] = [
  { email: 'correo.suspendido@example.com', motivo: 'Reportes falsos repetidos', fecha: iso(4) },
];

const logs = [
  { id: 1, email: 'admin@safezone.mx', evento: 'admin_ok', ip: '192.168.1.20', creado_en: iso(0, 1) },
  { id: 2, email: 'demo@safezone.mx', evento: 'login_ok', ip: '192.168.1.31', creado_en: iso(0, 2) },
  { id: 3, email: 'maria.lopez@tectijuana.edu.mx', evento: 'registro', ip: '192.168.1.44', creado_en: iso(1, 3) },
  { id: 4, email: 'correo.suspendido@example.com', evento: 'bloqueado', ip: '192.168.1.55', creado_en: iso(2, 1) },
  { id: 5, email: 'jorge.ramirez@tectijuana.edu.mx', evento: 'login_ok', ip: '192.168.1.61', creado_en: iso(2, 5) },
  { id: 6, email: 'ana.torres@tectijuana.edu.mx', evento: 'login_fail', ip: '192.168.1.72', creado_en: iso(3, 2) },
];

const publicUser = (u: DemoUser) => ({
  id: u.id, email: u.email, nombre: u.nombre, rol: u.rol,
});

function scoreFor(zona: DemoZone) {
  const activos = reportes.filter(r =>
    r.delegacion_id === zona.id && r.estado === 'activo' && !r.eliminado
  );
  const acumulados = activos.reduce((s, r) => s + Number(r.peso_capturado), 0);
  const total = Math.min(zona.base + acumulados, 120);
  const porcentaje = Number(((total / 120) * 100).toFixed(2));
  const nivel_riesgo = porcentaje < 30 ? 'bajo' : porcentaje <= 65 ? 'medio' : 'alto';

  return {
    delegacion_id: zona.id,
    delegacion: zona.nombre,
    periodo_inicio: periodStart,
    puntos_base: zona.base,
    puntos_acumulados: Number(acumulados.toFixed(2)),
    puntos_totales: Number(total.toFixed(2)),
    porcentaje,
    nivel_riesgo,
    total_reportes: activos.length,
    actualizado_en: iso(),
  };
}

const indice = () => zonas.map(scoreFor).sort((a, b) => b.puntos_totales - a.puntos_totales);

const wait = () => new Promise(resolve => setTimeout(resolve, 220));

function bodyOf(options: RequestInit) {
  try { return options.body ? JSON.parse(String(options.body)) : {}; }
  catch { return {}; }
}

export async function demoApiFetch(path: string, options: RequestInit = {}): Promise<any> {
  await wait();
  const method = (options.method || 'GET').toUpperCase();
  const body = bodyOf(options);

  if (path === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const user = usuarios.find(u => u.email === email);
    if (!user || user.password !== body.password) throw new Error('Correo o contraseña incorrectos.');
    if (user.estado !== 'activo') throw new Error('Tu cuenta no está activa.');
    if (body.adminCode !== undefined && body.adminCode !== '') {
      if (user.rol !== 'admin' || body.adminCode !== DEMO_CODE) {
        throw new Error('Código de administrador incorrecto.');
      }
    }
    currentUser = user;
    return { token: 'demo-token', user: publicUser(user) };
  }

  if (path === '/auth/register' && method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    if (usuarios.some(u => u.email === email)) throw new Error('Ese correo ya está registrado.');
    const user: DemoUser = {
      id: usuarios.length + 1, email, nombre: body.nombre || 'Usuario Demo',
      matricula: body.matricula ?? null, password: body.password || 'demo1234',
      rol: 'ciudadano', estado: 'activo', creado_en: iso(),
    };
    usuarios.push(user);
    currentUser = user;
    return { token: 'demo-token', user: publicUser(user) };
  }

  if (path === '/auth/logout' && method === 'POST') {
    currentUser = null;
    return { success: true };
  }

  if (path === '/auth/me') {
    const user = currentUser || usuarios[0];
    return { user: publicUser(user) };
  }

  if (path === '/delegaciones') {
    return zonas.map(z => ({ id: z.id, nombre: z.nombre, lat: z.lat, lng: z.lng }));
  }

  if (path === '/indice-riesgo' && method === 'GET') return indice();
  if (path === '/indice-riesgo/recalcular' && method === 'POST') return indice();

  if (path === '/reportes' && method === 'GET') {
    return [...reportes]
      .filter(r => !r.eliminado)
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  }

  if (path === '/reportes' && method === 'POST') {
    const zona = zonas.find(z => z.nombre === body.zona_nombre);
    if (!zona) throw new Error('Se requiere una zona válida.');

    const tipo = String(body.tipo_nombre || 'otro');
    const pesos: Record<string, number> = {
      accidente: 0.5, sospechoso: 1, robo: 1.5, asalto: 2,
      violencia: 2, secuestro: 3, homicidio: 4, otro: 0.5,
    };
    const etiquetas: Record<string, string> = {
      accidente: 'Accidente / choque', sospechoso: 'Actividad sospechosa',
      robo: 'Robo', asalto: 'Asalto armado', violencia: 'Robo con violencia',
      secuestro: 'Secuestro', homicidio: 'Homicidio', otro: 'Otro',
    };
    const user = currentUser || usuarios[0];
    const nuevo: DemoReporte = {
      id: reportes.length + 1, delegacion_id: zona.id, zona: zona.nombre,
      tipo: etiquetas[tipo] ?? 'Otro', peso_capturado: pesos[tipo] ?? 0.5,
      descripcion: body.descripcion ?? 'Reporte de demostración.',
      estado: 'activo', eliminado: 0, creado_en: iso(), usuario: user.email,
    };
    reportes.unshift(nuevo);
    return { success: true, id: nuevo.id, peso: nuevo.peso_capturado };
  }

  const patchReporte = path.match(/^\/reportes\/(\d+)$/);
  if (patchReporte && method === 'PATCH') {
    const r = reportes.find(x => x.id === Number(patchReporte[1]));
    if (r && body.estado) r.estado = body.estado;
    return { success: true };
  }
  if (patchReporte && method === 'DELETE') {
    const r = reportes.find(x => x.id === Number(patchReporte[1]));
    if (r) { r.estado = 'archivado'; r.eliminado = 1; }
    return { success: true };
  }

  if (path === '/admin/usuarios' && method === 'GET') {
    return usuarios.map(({ password, ...u }) => u);
  }

  const patchUser = path.match(/^\/admin\/usuarios\/(\d+)$/);
  if (patchUser && method === 'PATCH') {
    const u = usuarios.find(x => x.id === Number(patchUser[1]));
    if (u) {
      if (body.nombre !== undefined) u.nombre = body.nombre;
      if (body.estado !== undefined) u.estado = body.estado;
      if (body.rol !== undefined) u.rol = body.rol;
    }
    return { success: true };
  }
  if (patchUser && method === 'DELETE') {
    const i = usuarios.findIndex(x => x.id === Number(patchUser[1]));
    if (i >= 0) usuarios.splice(i, 1);
    return { success: true };
  }

  if (path === '/admin/bloqueos' && method === 'GET') return bloquearon;
  if (path === '/admin/bloqueos' && method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const existente = bloquearon.find(b => b.email === email);
    if (existente) existente.motivo = body.motivo ?? existente.motivo;
    else bloquearon.unshift({ email, motivo: body.motivo ?? '', fecha: iso() });
    return { success: true };
  }
  const delBloqueo = path.match(/^\/admin\/bloqueos\/(.+)$/);
  if (delBloqueo && method === 'DELETE') {
    const email = decodeURIComponent(delBloqueo[1]).toLowerCase();
    const i = bloquearon.findIndex(b => b.email === email);
    if (i >= 0) bloquearon.splice(i, 1);
    return { success: true };
  }

  if (path === '/admin/logs' && method === 'GET') return logs;

  throw new Error(`Ruta demo no disponible: ${path}`);
}
