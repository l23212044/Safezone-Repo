/**
 * SafeZone – authRoutes.js
 * Autenticación propia con MySQL (bcrypt + JWT) y gestión de usuarios admin.
 *
 * En index.js se registra automáticamente con:
 *   require('./authRoutes')(app, pool);
 */
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ⚠ Cambia estos valores y NO los subas a un repositorio público.
// Lo ideal es ponerlos en variables de entorno (process.env.*).
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esto-por-una-cadena-larga-y-aleatoria';
const ADMIN_CODE = process.env.ADMIN_CODE || 'Parts1512';
const TOKEN_TTL  = '7d';
const MAX_FAILS  = 5;      // intentos fallidos permitidos
const FAIL_WINDOW_MIN = 15; // ventana en minutos

module.exports = function (app, pool) {

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const ip = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0, 45);

  async function log(evento, email, usuarioId, req) {
    try {
      await pool.query(
        'INSERT INTO logs_acceso (usuario_id, email, evento, ip) VALUES (?,?,?,?)',
        [usuarioId ?? null, email ?? null, evento, ip(req)]
      );
    } catch (e) { console.error('log error:', e.message); }
  }

  function sign(u) {
    return jwt.sign({ id: u.id, email: u.email, rol: u.rol }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  }

  const publicUser = (u) => ({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol });

  function requireAuth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autenticado' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { res.status(401).json({ message: 'Sesión inválida o expirada' }); }
  }

  function requireAdmin(req, res, next) {
    if (req.user?.rol !== 'admin') return res.status(403).json({ message: 'Solo administradores' });
    next();
  }

  // ─── Registro ───────────────────────────────────────────────────────────────
  app.post('/auth/register', async (req, res) => {
    const { email, password, nombre, matricula } = req.body;
    if (!email || !password || !nombre) return res.status(400).json({ message: 'Faltan datos' });
    if (!/\S+@\S+\.\S+/.test(email))   return res.status(400).json({ message: 'Correo inválido' });
    if (password.length < 6)           return res.status(400).json({ message: 'Mínimo 6 caracteres' });

    const mail = email.toLowerCase().trim();
    try {
      const [bl] = await pool.query('SELECT 1 FROM usuarios_bloqueados WHERE email = ?', [mail]);
      if (bl.length) { await log('bloqueado', mail, null, req); return res.status(403).json({ message: 'Este correo no tiene acceso a SafeZone.' }); }

      const [ex] = await pool.query('SELECT 1 FROM usuarios WHERE email = ?', [mail]);
      if (ex.length) return res.status(409).json({ message: 'Ese correo ya está registrado.' });

      const hash = await bcrypt.hash(password, 10);
      const [r] = await pool.query(
        'INSERT INTO usuarios (email, nombre, matricula, password_hash) VALUES (?,?,?,?)',
        [mail, nombre.trim(), matricula ?? null, hash]
      );
      const user = { id: r.insertId, email: mail, nombre: nombre.trim(), rol: 'ciudadano' };
      await log('registro', mail, user.id, req);
      res.status(201).json({ token: sign(user), user: publicUser(user) });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ─── Login ──────────────────────────────────────────────────────────────────
  app.post('/auth/login', async (req, res) => {
    const { email, password, adminCode } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Faltan datos' });
    const mail = email.toLowerCase().trim();

    try {
      // Anti fuerza bruta
      const [fails] = await pool.query(
        `SELECT COUNT(*) AS n FROM logs_acceso
         WHERE email = ? AND evento = 'login_fail'
           AND creado_en > NOW() - INTERVAL ? MINUTE`, [mail, FAIL_WINDOW_MIN]);
      if (fails[0].n >= MAX_FAILS)
        return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' });

      const [bl] = await pool.query('SELECT 1 FROM usuarios_bloqueados WHERE email = ?', [mail]);
      if (bl.length) { await log('bloqueado', mail, null, req); return res.status(403).json({ message: 'Tu acceso ha sido suspendido. Contacta al administrador.' }); }

      const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [mail]);
      const u = rows[0];
      const ok = u && await bcrypt.compare(password, u.password_hash);
      if (!ok) { await log('login_fail', mail, u?.id, req); return res.status(401).json({ message: 'Correo o contraseña incorrectos.' }); }
      if (u.estado !== 'activo') { await log('bloqueado', mail, u.id, req); return res.status(403).json({ message: 'Tu cuenta no está activa.' }); }

      // Acceso administrador: rol 'admin' en BD + código (validado en el servidor)
      if (adminCode !== undefined && adminCode !== '') {
        if (u.rol !== 'admin' || adminCode !== ADMIN_CODE) {
          await log('admin_fail', mail, u.id, req);
          return res.status(403).json({ message: 'Código de administrador incorrecto.' });
        }
        await log('admin_ok', mail, u.id, req);
      } else {
        await log('login_ok', mail, u.id, req);
      }

      res.json({ token: sign(u), user: publicUser(u) });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ─── Sesión / logout ────────────────────────────────────────────────────────
  app.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

  app.post('/auth/logout', requireAuth, async (req, res) => {
    await log('logout', req.user.email, req.user.id, req);
    res.json({ success: true });
  });

  // ─── Admin: usuarios ────────────────────────────────────────────────────────
  app.get('/admin/usuarios', requireAuth, requireAdmin, async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, email, nombre, matricula, rol, estado, creado_en FROM usuarios ORDER BY creado_en DESC');
    res.json(rows);
  });

  app.patch('/admin/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
    const { nombre, estado, rol } = req.body;
    const campos = [], vals = [];
    if (nombre !== undefined) { campos.push('nombre = ?'); vals.push(nombre); }
    if (estado !== undefined) {
      if (!['activo','suspendido','inactivo'].includes(estado)) return res.status(400).json({ message: 'Estado inválido' });
      campos.push('estado = ?'); vals.push(estado);
    }
    if (rol !== undefined) {
      if (!['ciudadano','admin'].includes(rol)) return res.status(400).json({ message: 'Rol inválido' });
      campos.push('rol = ?'); vals.push(rol);
    }
    if (!campos.length) return res.status(400).json({ message: 'Nada que actualizar' });
    await pool.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
    res.json({ success: true });
  });

  app.delete('/admin/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
    // Los reportes se conservan, solo se desliga el usuario
    await pool.query('UPDATE reportes SET usuario_id = NULL WHERE usuario_id = ?', [req.params.id]);
    await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ─── Admin: correos bloqueados ──────────────────────────────────────────────
  app.get('/admin/bloqueos', requireAuth, requireAdmin, async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM usuarios_bloqueados ORDER BY fecha DESC');
    res.json(rows);
  });

  app.post('/admin/bloqueos', requireAuth, requireAdmin, async (req, res) => {
    const { email, motivo } = req.body;
    if (!email) return res.status(400).json({ message: 'Correo requerido' });
    await pool.query(
      'INSERT INTO usuarios_bloqueados (email, motivo) VALUES (?,?) ON DUPLICATE KEY UPDATE motivo = VALUES(motivo)',
      [email.toLowerCase().trim(), motivo ?? null]);
    res.status(201).json({ success: true });
  });

  app.delete('/admin/bloqueos/:email', requireAuth, requireAdmin, async (req, res) => {
    await pool.query('DELETE FROM usuarios_bloqueados WHERE email = ?', [req.params.email.toLowerCase()]);
    res.json({ success: true });
  });

  // ─── Admin: logs de acceso ──────────────────────────────────────────────────
  app.get('/admin/logs', requireAuth, requireAdmin, async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, email, evento, ip, creado_en FROM logs_acceso ORDER BY creado_en DESC LIMIT 200');
    res.json(rows);
  });

  // Exporta el middleware por si lo quieres usar en otras rutas (ej. POST /reportes)
  app.locals.requireAuth  = requireAuth;
  app.locals.requireAdmin = requireAdmin;
};