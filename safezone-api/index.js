/**
 * SafeZone API – MySQL
 * Express + MySQL (mysql2) + autenticación JWT.
 *
 *   cp .env.example .env
 *   npm install
 *   npm start
 */
require('dotenv').config();

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT || 3306),
  user:               process.env.DB_USER     || 'safezone_app',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'safezone_db',
  waitForConnections: true,
  connectionLimit:    10,
  connectTimeout:     10000,
});

// Autenticación y rutas de administración (bcrypt + JWT)
require('./authRoutes')(app, pool);

const requireAuth  = (req, res, next) => app.locals.requireAuth(req, res, next);
const requireAdmin = (req, res, next) => app.locals.requireAdmin(req, res, next);

const MAX_POINTS = 120;

function periodoActual() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

async function recalcularIndice(delegacion_id) {
  const periodo = periodoActual();

  const [reportes] = await pool.query(
    `SELECT COALESCE(SUM(peso_capturado), 0) AS suma, COUNT(*) AS cnt
     FROM reportes
     WHERE delegacion_id = ? AND periodo_inicio = ?
       AND estado = 'activo' AND eliminado = 0`,
    [delegacion_id, periodo]
  );

  const [base] = await pool.query(
    `SELECT COALESCE(puntos_base, 0) AS base
     FROM indice_riesgo
     WHERE delegacion_id = ? AND periodo_inicio = ?`,
    [delegacion_id, periodo]
  );

  const puntos_base       = parseFloat(base[0]?.base ?? 0);
  const puntos_acumulados = parseFloat(reportes[0].suma ?? 0);
  const puntos_totales    = Math.min(puntos_base + puntos_acumulados, MAX_POINTS);
  const porcentaje        = parseFloat(((puntos_totales / MAX_POINTS) * 100).toFixed(2));
  const nivel_riesgo      = porcentaje < 30 ? 'bajo' : porcentaje <= 65 ? 'medio' : 'alto';

  await pool.query(
    `INSERT INTO indice_riesgo
       (delegacion_id, periodo_inicio, puntos_base, puntos_acumulados,
        puntos_totales, porcentaje, nivel_riesgo, total_reportes, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       puntos_acumulados = VALUES(puntos_acumulados),
       puntos_totales    = VALUES(puntos_totales),
       porcentaje        = VALUES(porcentaje),
       nivel_riesgo      = VALUES(nivel_riesgo),
       total_reportes    = VALUES(total_reportes),
       actualizado_en    = NOW()`,
    [delegacion_id, periodo, puntos_base, puntos_acumulados,
     puntos_totales, porcentaje, nivel_riesgo, reportes[0].cnt]
  );
}

async function listarIndice() {
  const [rows] = await pool.query(
    `SELECT d.id AS delegacion_id, d.nombre AS delegacion, ir.periodo_inicio,
            COALESCE(ir.puntos_base, 0)       AS puntos_base,
            COALESCE(ir.puntos_acumulados, 0) AS puntos_acumulados,
            COALESCE(ir.puntos_totales, 0)    AS puntos_totales,
            COALESCE(ir.porcentaje, 0)        AS porcentaje,
            COALESCE(ir.nivel_riesgo, 'bajo') AS nivel_riesgo,
            COALESCE(ir.total_reportes, 0)    AS total_reportes,
            ir.actualizado_en
     FROM delegaciones d
     LEFT JOIN indice_riesgo ir
       ON ir.delegacion_id = d.id AND ir.periodo_inicio = ?
     WHERE d.activa = 1
     ORDER BY puntos_totales DESC, d.nombre`,
    [periodoActual()]
  );
  return rows;
}

// ─── Salud ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'MySQL', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/ping', (_req, res) =>
  res.json({ ok: true, msg: 'API SafeZone activa · MySQL' })
);

// ─── Delegaciones ─────────────────────────────────────────────────────────────
app.get('/delegaciones', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, lat, lng FROM delegaciones WHERE activa = 1 ORDER BY nombre'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─── Reportes ─────────────────────────────────────────────────────────────────
app.post('/reportes', requireAuth, async (req, res) => {
  const { delegacion_id, zona_nombre, tipo_id, tipo_nombre, descripcion, lat, lng } = req.body;

  try {
    let delId = delegacion_id;
    let tipId = tipo_id;

    if (!delId && zona_nombre) {
      const [rows] = await pool.query(
        'SELECT id FROM delegaciones WHERE nombre = ? AND activa = 1',
        [zona_nombre]
      );
      if (!rows.length) return res.status(400).json({ message: `Zona no encontrada: ${zona_nombre}` });
      delId = rows[0].id;
    }

    if (!tipId && tipo_nombre) {
      const [rows] = await pool.query(
        'SELECT id, peso FROM tipos_incidente WHERE (clave = ? OR etiqueta = ?) AND activo = 1',
        [String(tipo_nombre).toLowerCase().trim(), tipo_nombre]
      );
      if (rows.length) {
        tipId = rows[0].id;
      } else {
        const [otro] = await pool.query(
          "SELECT id FROM tipos_incidente WHERE clave = 'otro' AND activo = 1"
        );
        tipId = otro[0]?.id;
      }
    }

    if (!delId || !tipId) {
      return res.status(400).json({ message: 'Se requiere zona y tipo de incidente' });
    }

    const [tipoRows] = await pool.query(
      'SELECT peso FROM tipos_incidente WHERE id = ?', [tipId]
    );
    if (!tipoRows.length) return res.status(400).json({ message: 'Tipo no válido' });

    const peso = tipoRows[0].peso ?? 0.5;
    const [result] = await pool.query(
      `INSERT INTO reportes
         (delegacion_id, usuario_id, tipo_id, peso_capturado, descripcion,
          estado, lat, lng, periodo_inicio)
       VALUES (?, ?, ?, ?, ?, 'activo', ?, ?, ?)`,
      [delId, req.user.id, tipId, peso, descripcion ?? null,
       lat ?? null, lng ?? null, periodoActual()]
    );

    await recalcularIndice(delId);

    res.status(201).json({ success: true, id: result.insertId, peso });
  } catch (e) {
    console.error('Error insertando reporte:', e.message);
    res.status(500).json({ message: e.message });
  }
});

app.get('/reportes', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, d.nombre AS zona, ti.etiqueta AS tipo,
             r.peso_capturado, r.descripcion, r.estado, r.creado_en,
             u.email AS usuario
      FROM reportes r
      JOIN delegaciones    d  ON d.id  = r.delegacion_id
      JOIN tipos_incidente ti ON ti.id = r.tipo_id
      LEFT JOIN usuarios   u  ON u.id  = r.usuario_id
      WHERE r.eliminado = 0
      ORDER BY r.creado_en DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/reportes/:delegacion_id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, ti.etiqueta AS tipo, r.peso_capturado,
             r.descripcion, r.estado, r.creado_en
      FROM reportes r
      JOIN tipos_incidente ti ON ti.id = r.tipo_id
      WHERE r.delegacion_id = ? AND r.eliminado = 0
      ORDER BY r.creado_en DESC
      LIMIT 50
    `, [req.params.delegacion_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.patch('/reportes/:id', requireAuth, requireAdmin, async (req, res) => {
  const { estado } = req.body;
  const estados = ['activo', 'revisado', 'archivado', 'rechazado'];
  if (!estados.includes(estado)) return res.status(400).json({ message: 'Estado inválido' });

  try {
    const [rows] = await pool.query('SELECT delegacion_id FROM reportes WHERE id = ?', [req.params.id]);
    await pool.query('UPDATE reportes SET estado = ? WHERE id = ?', [estado, req.params.id]);
    if (rows.length) await recalcularIndice(rows[0].delegacion_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.delete('/reportes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT delegacion_id FROM reportes WHERE id = ?', [req.params.id]);
    await pool.query("UPDATE reportes SET estado = 'archivado', eliminado = 1 WHERE id = ?", [req.params.id]);
    if (rows.length) await recalcularIndice(rows[0].delegacion_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─── Índice de riesgo ─────────────────────────────────────────────────────────
app.get('/indice-riesgo', requireAuth, async (_req, res) => {
  try {
    res.json(await listarIndice());
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/indice-riesgo/recalcular', requireAuth, async (_req, res) => {
  try {
    const [delegaciones] = await pool.query('SELECT id FROM delegaciones WHERE activa = 1');
    for (const d of delegaciones) await recalcularIndice(d.id);
    res.json(await listarIndice());
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─── Inicio ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, '0.0.0.0', async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Conectado a MySQL');
    console.log(`✓ API SafeZone corriendo en http://0.0.0.0:${PORT}`);
    console.log('  Desde el celular: http://TU_IP_LOCAL:' + PORT);
  } catch (e) {
    console.error('✗ Error conectando a MySQL:', e.message);
  }
}).on('error', (err) => {
  console.error('Error al iniciar servidor:', err.message);
});
