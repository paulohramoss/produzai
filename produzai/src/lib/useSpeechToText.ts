import { useRef, useState } from 'react'

// Web Speech API — disponível no Chrome/Edge via prefixo webkit
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const SpeechRecognitionCtor: SpeechRecognitionConstructor | null =
  typeof window !== 'undefined'
    ? ((window as WindowWithSpeechRecognition).SpeechRecognition ?? (window as WindowWithSpeechRecognition).webkitSpeechRecognition ?? null)
    : null

/**
 * Ditado por voz em português via Web Speech API do navegador (Chrome/Edge).
 * `onTranscript` é chamado a cada trecho reconhecido — quem chama decide se
 * substitui ou concatena ao texto anterior.
 */
export function useSpeechToText(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  function toggle() {
    if (!SpeechRecognitionCtor) return
    if (recording) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SpeechRecognitionCtor()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let transcript = ''
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript
      transcript = transcript.trim()
      if (transcript) onTranscript(transcript)
    }
    rec.onerror = () => setRecording(false)
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
  }

  return { recording, toggle, supported: SpeechRecognitionCtor !== null }
}
