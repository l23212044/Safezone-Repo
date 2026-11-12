/**
 * SafeZone – riskEngine.ts (versión MySQL)
 * El cálculo del índice se realiza en la API (safezone-api/index.js).
 * Este módulo solo consume GET /indice-riesgo y POST /indice-riesgo/recalcular.
 */
import { apiFetch } from './authService';

export const MAX_POINTS   = 120;
export const LIMIT_LOW    = 0.30;
export const LIMIT_MEDIUM = 0.65;

export const INCIDENT_WEIGHTS: Record<string, number> = {
  accidente:  0.5,
  choque:     0.5,
  sospechoso: 1.0,
  robo:       1.5,
  asalto:     2.0,
  violencia:  2.0,
  secuestro:  3.0,
  homicidio:  4.0,
  otro:       0.5,
};

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ZoneScore {
  zoneId:      string;
  zoneName:    string;
  rawPoints:   number;
  percentage:  number;
  risk:        RiskLevel;
  reportCount: number;
  breakdown:   Record<string, { count: number; points: number }>;
  updatedAt:   string;
  periodStart: string;
  periodEnd:   string;
}

export function getWeight(tipo: string): number {
  const key = tipo.toLowerCase().trim();
  for (const [k, v] of Object.entries(INCIDENT_WEIGHTS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return INCIDENT_WEIGHTS['otro'];
}

export function classifyRisk(percentage: number): RiskLevel {
  if (percentage < LIMIT_LOW * 100)     return 'low';
  if (percentage <= LIMIT_MEDIUM * 100) return 'medium';
  return 'high';
}

export function currentPeriodStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function currentPeriodEnd(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mapRow(row: any): ZoneScore {
  const risk = row.nivel_riesgo === 'alto' ? 'high'
             : row.nivel_riesgo === 'medio' ? 'medium'
             : 'low';

  return {
    zoneId:      String(row.delegacion_id),
    zoneName:    row.delegacion,
    rawPoints:   Number(row.puntos_totales ?? 0),
    percentage:  Number(row.porcentaje ?? 0),
    risk,
    reportCount: Number(row.total_reportes ?? 0),
    breakdown:   {},
    updatedAt:   row.actualizado_en ?? new Date().toISOString(),
    periodStart: formatDate(currentPeriodStart()),
    periodEnd:   formatDate(currentPeriodEnd()),
  };
}

export async function loadSavedScores(_zoneIds?: string[]): Promise<ZoneScore[]> {
  const rows = await apiFetch('/indice-riesgo');
  return rows.map(mapRow);
}

export async function calculateAllScores(_zoneIds?: string[]): Promise<ZoneScore[]> {
  const rows = await apiFetch('/indice-riesgo/recalcular', { method: 'POST' });
  return rows.map(mapRow);
}
