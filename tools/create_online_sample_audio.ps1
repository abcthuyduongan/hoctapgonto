param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$sampleAudioDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($sampleAudioDirectory) | Out-Null
$sampleVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $englishVoice = $sampleVoice.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1
  if (-not $englishVoice) { throw 'An installed en-US speech voice is required to create the spoken sample audio.' }
  $sampleVoice.SelectVoice($englishVoice.VoiceInfo.Name)
  $sampleVoice.Rate = -2
  $sampleVoice.Volume = 100
  $sampleFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
  $sampleLines = @(
    @{ File = 'nghe-chon.wav'; Text = 'This is my red bag. I have three books.' },
    @{ File = 'nghe-dien.wav'; Text = 'My name is Anna. I am eight years old.' }
  )
  foreach ($sampleLine in $sampleLines) {
    $sampleVoice.SetOutputToWaveFile([System.IO.Path]::Combine($sampleAudioDirectory,$sampleLine.File),$sampleFormat)
    $sampleVoice.Speak($sampleLine.Text)
    $sampleVoice.SetOutputToNull()
  }
} finally { $sampleVoice.Dispose() }
