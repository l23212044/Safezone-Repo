import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

export const MAX_POINTS = 120;
export const LIMIT_LOW = 0.3;
export const LIMIT_MEDIUM = 0.65;

export const INCIDENT_WEIGHTS: Record<string, number> = {
  accidente: 0.5,
  choque: 0.5,
  sospechoso: 1,
  robo: 1.5,
  asalto: 2,
  violencia: 2,
  secuestro: 3,
  homicidio: 4,
  otro: 0.5,
};

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ZoneScore {
  zoneId: string;
  zoneName: string;
  rawPoints: number;
  percentage: number;
  risk: RiskLevel;
  reportCount: number;
  breakdown: Record<string, { count: number; points: number }>;
  updatedAt: string;
  periodStart: string;
  periodEnd: string;
}

export function getWeight(tipo: string): number {
  const key = tipo.toLowerCase().trim();
  for (const [incident, weight] of Object.entries(INCIDENT_WEIGHTS)) {
    if (key.includes(incident) || incident.includes(key)) return weight;
  }
  return INCIDENT_WEIGHTS.otro;
}

export function classifyRisk(percentage: number): RiskLevel {
  if (percentage < LIMIT_LOW * 100) return 'low';
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

export async function calculateAllScores(zoneIds: string[]): Promise<ZoneScore[]> {
  const periodStart = currentPeriodStart();
  const periodEnd = currentPeriodEnd();
  const snap = await getDocs(
    query(
      collection(db, 'reportes'),
      where('timestamp', '>=', Timestamp.fromDate(periodStart)),
      where('timestamp', '<=', Timestamp.fromDate(periodEnd)),
    ),
  );
  const reportes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const byZone: Record<string, any[]> = {};
  zoneIds.forEach(id => { byZone[id] = []; });
  reportes.forEach((r: any) => {
    const zid = r.zonaId ?? r.zoneId ?? '';
    if (byZone[zid] !== undefined) byZone[zid].push(r);
  });

  const scores: ZoneScore[] = [];
  for (const [zoneId, reps] of Object.entries(byZone)) {
    const breakdown: Record<string, { count: number; points: number }> = {};
    let rawPoints = 0;
    reps.forEach(r => {
      const tipo = r.tipo ?? 'otro';
      const weight = getWeight(tipo);
      rawPoints += weight;
      breakdown[tipo] ??= { count: 0, points: 0 };
      breakdown[tipo].count += 1;
      breakdown[tipo].points += weight;
    });
    const percentage = Number(((Math.min(rawPoints, MAX_POINTS) / MAX_POINTS) * 100).toFixed(1));
    const score: ZoneScore = {
      zoneId,
      zoneName: reps[0]?.zonaNombre ?? zoneId,
      rawPoints: Number(rawPoints.toFixed(2)),
      percentage,
      risk: classifyRisk(percentage),
      reportCount: reps.length,
      breakdown,
      updatedAt: new Date().toISOString(),
      periodStart: formatDate(periodStart),
      periodEnd: formatDate(periodEnd),
    };
    scores.push(score);
    await setDoc(doc(db, 'zone_scores', zoneId), score);
  }
  return scores;
}

export async function loadSavedScores(zoneIds: string[]): Promise<ZoneScore[]> {
  const scores: ZoneScore[] = [];
  for (const id of zoneIds) {
    const snap = await getDoc(doc(db, 'zone_scores', id));
    if (snap.exists()) scores.push(snap.data() as ZoneScore);
  }
  return scores;
}
