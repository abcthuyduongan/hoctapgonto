export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i],result[j]] = [result[j],result[i]];
  }
  return result;
}
export function titleSubject(subject: string) {
  return ({math:'Toán',vietnamese:'Tiếng Việt',english:'Tiếng Anh',thinking:'Tư duy'} as Record<string,string>)[subject] ?? subject;
}
export function newId(): string { return crypto.randomUUID(); }
