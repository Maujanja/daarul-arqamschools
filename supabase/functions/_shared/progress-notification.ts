import type { StudentProgress } from './student-progress.ts';

export function makeProgressNotification(student: { id: string; full_name: string; parent_id?: string | null }, progress: StudentProgress) {
  if (!progress.hasAlert || !progress.latest) return null;
  const first = progress.alerts[0];
  const detail = first
    ? first.previous !== null && (first.delta || 0) < 0
      ? `${first.name} kutoka ${first.previous} hadi ${first.score}`
      : `${first.name}: alama ${first.score}, chini ya kiwango cha ufaulu`
    : `wastani umeshuka kwa pointi ${Math.abs(progress.averageDelta || 0).toFixed(1)}`;
  return {
    payload: {
      title: 'Tahadhari ya maendeleo ya mtoto',
      body: `Tahadhari: ${student.full_name}, ${detail}. Ingia kwenye mfumo kusikia maelezo zaidi.`,
      url: `/dashboard?progress=1&year=${encodeURIComponent(progress.year)}`,
      tag: `progress-${student.id}-${progress.year}-${progress.latest}`,
      requireInteraction: false,
    },
    target: { role: 'parent', userIdentifiers: [...new Set([student.id, student.parent_id].filter((id): id is string => Boolean(id)))] },
  };
}