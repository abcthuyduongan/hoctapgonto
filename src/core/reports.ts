import type { LearningEvent, PlaySession } from './contracts';

export function calculateReport(events: LearningEvent[], sessions: PlaySession[]) {
  const successful = events.filter(e => e.correct);
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const objectives = new Map<string,{correct:number,total:number,hints:number}>();
  for (const event of events) {
    const row = objectives.get(event.objectiveId) ?? {correct:0,total:0,hints:0};
    row.total++;
    row.correct += event.correct ? 1 : 0;
    row.hints += event.hintsUsed;
    objectives.set(event.objectiveId,row);
  }
  return {
    attempts: events.length,
    correct: successful.length,
    accuracy: events.length ? Math.round(successful.length / events.length * 100) : 0,
    completed: completedSessions.length,
    objectives: [...objectives.entries()].map(([id,row]) => ({id,...row,accuracy:Math.round(row.correct/row.total*100)}))
  };
}
