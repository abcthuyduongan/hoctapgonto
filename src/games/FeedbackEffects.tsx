/** Decorative, non-interactive reaction inside a reserved feedback frame.
 * Key it by the question/attempt so replay is tied to actual persisted learning actions.
 */
export default function FeedbackEffects({result, eventKey}: {
  result: 'success'|'retry'|null;
  eventKey: string;
}) {
  if (!result) return null;
  return <div key={`${eventKey}-${result}`} className={`game-reaction game-reaction-${result}`} aria-hidden="true">
    {Array.from({length:6},(_,i)=><i key={i} className={`game-reaction-particle game-reaction-${i+1}`}/>)}
    <span className="game-reaction-halo"/>
  </div>;
}
