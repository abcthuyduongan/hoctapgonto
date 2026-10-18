let playing:HTMLAudioElement|null=null;

/** Shared by question players, including two revealed memory-card audio controls. */
export function activateQuestionAudio(audio:HTMLAudioElement):void {
  if(playing&&playing!==audio)playing.pause();
  playing=audio;
}

export function stopQuestionAudio():void {
  playing?.pause();
  playing=null;
}

export function forgetQuestionAudio(audio:HTMLAudioElement):void {
  if(playing===audio)playing=null;
}

/** Detached players must release their decoder/network resource as well as stop. */
export function releaseQuestionAudio(audio:HTMLAudioElement):void {
  forgetQuestionAudio(audio);
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}
