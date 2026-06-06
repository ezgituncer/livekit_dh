import { DEFAULT_LANGUAGE } from '@/app-config';

/**
 * UI string catalog. Every user-facing label in the app maps to a key here so
 * the whole interface follows the selected conversation language. Keep `en` as
 * the canonical/fallback locale — every other locale must define the same keys
 * (enforced by the `Record<…, UIStrings>` type below).
 */
export interface UIStrings {
  welcomeHeadline: string;
  startCall: string;
  startAudio: string;
  agentListening: string;
  language: string;
  conversationLanguage: string;
  switchingLanguage: string;
  controls: string;
  toggleMic: string;
  muteMic: string;
  unmuteMic: string;
  typeMessage: string;
  toggleTranscript: string;
  transcript: string;
  sendMessage: string;
  sending: string;
  send: string;
  endCall: string;
  skip: string;
  sessionEnded: string;
}

export type LangCode = 'tr' | 'en' | 'ar' | 'es' | 'pt' | 'ru';

/** Languages written right-to-left. */
export const RTL_LANGS: ReadonlySet<string> = new Set<string>(['ar']);

export const TRANSLATIONS: Record<LangCode, UIStrings> = {
  en: {
    welcomeHeadline: 'Chat live with your voice AI agent',
    startCall: 'Start call',
    startAudio: 'Start audio',
    agentListening: 'The agent is listening — ask it anything',
    language: 'Language',
    conversationLanguage: 'Conversation language',
    switchingLanguage: 'Switching language…',
    controls: 'Voice assistant controls',
    toggleMic: 'Toggle microphone',
    muteMic: 'Mute microphone',
    unmuteMic: 'Unmute microphone',
    typeMessage: 'Type a message or tap the mic to speak…',
    toggleTranscript: 'Toggle transcript',
    transcript: 'Transcript',
    sendMessage: 'Send message',
    sending: 'Sending…',
    send: 'Send',
    endCall: 'End call',
    skip: 'Skip',
    sessionEnded: 'Session ended',
  },
  tr: {
    welcomeHeadline: 'Sesli yapay zekâ asistanınla canlı konuş',
    startCall: 'Görüşmeyi başlat',
    startAudio: 'Sesi başlat',
    agentListening: 'Asistan dinliyor — istediğini sor',
    language: 'Dil',
    conversationLanguage: 'Konuşma dili',
    switchingLanguage: 'Dil değiştiriliyor…',
    controls: 'Sesli asistan kontrolleri',
    toggleMic: 'Mikrofonu aç/kapat',
    muteMic: 'Mikrofonu kapat',
    unmuteMic: 'Mikrofonu aç',
    typeMessage: 'Bir mesaj yaz ya da mikrofona dokunup konuş…',
    toggleTranscript: 'Dökümü aç/kapat',
    transcript: 'Konuşma dökümü',
    sendMessage: 'Mesaj gönder',
    sending: 'Gönderiliyor…',
    send: 'Gönder',
    endCall: 'Görüşmeyi bitir',
    skip: 'Atla',
    sessionEnded: 'Oturum sona erdi',
  },
  ar: {
    welcomeHeadline: 'تحدّث مباشرةً مع مساعدك الصوتي الذكي',
    startCall: 'بدء المكالمة',
    startAudio: 'تشغيل الصوت',
    agentListening: 'المساعد يستمع — اسأله أي شيء',
    language: 'اللغة',
    conversationLanguage: 'لغة المحادثة',
    switchingLanguage: 'جارٍ تغيير اللغة…',
    controls: 'عناصر التحكم في المساعد الصوتي',
    toggleMic: 'تبديل الميكروفون',
    muteMic: 'كتم الميكروفون',
    unmuteMic: 'إلغاء كتم الميكروفون',
    typeMessage: 'اكتب رسالة أو انقر على الميكروفون للتحدث…',
    toggleTranscript: 'تبديل النص',
    transcript: 'نص المحادثة',
    sendMessage: 'إرسال الرسالة',
    sending: 'جارٍ الإرسال…',
    send: 'إرسال',
    endCall: 'إنهاء المكالمة',
    skip: 'تخطّي',
    sessionEnded: 'انتهت الجلسة',
  },
  es: {
    welcomeHeadline: 'Habla en vivo con tu agente de voz con IA',
    startCall: 'Iniciar llamada',
    startAudio: 'Iniciar audio',
    agentListening: 'El agente está escuchando: pregúntale lo que quieras',
    language: 'Idioma',
    conversationLanguage: 'Idioma de la conversación',
    switchingLanguage: 'Cambiando de idioma…',
    controls: 'Controles del asistente de voz',
    toggleMic: 'Activar/desactivar micrófono',
    muteMic: 'Silenciar micrófono',
    unmuteMic: 'Activar micrófono',
    typeMessage: 'Escribe un mensaje o toca el micrófono para hablar…',
    toggleTranscript: 'Mostrar/ocultar transcripción',
    transcript: 'Transcripción',
    sendMessage: 'Enviar mensaje',
    sending: 'Enviando…',
    send: 'Enviar',
    endCall: 'Finalizar llamada',
    skip: 'Saltar',
    sessionEnded: 'Sesión finalizada',
  },
  pt: {
    welcomeHeadline: 'Converse ao vivo com seu agente de voz com IA',
    startCall: 'Iniciar chamada',
    startAudio: 'Iniciar áudio',
    agentListening: 'O agente está ouvindo — pergunte o que quiser',
    language: 'Idioma',
    conversationLanguage: 'Idioma da conversa',
    switchingLanguage: 'Trocando de idioma…',
    controls: 'Controles do assistente de voz',
    toggleMic: 'Ativar/desativar microfone',
    muteMic: 'Silenciar microfone',
    unmuteMic: 'Ativar microfone',
    typeMessage: 'Digite uma mensagem ou toque no microfone para falar…',
    toggleTranscript: 'Mostrar/ocultar transcrição',
    transcript: 'Transcrição',
    sendMessage: 'Enviar mensagem',
    sending: 'Enviando…',
    send: 'Enviar',
    endCall: 'Encerrar chamada',
    skip: 'Pular',
    sessionEnded: 'Sessão encerrada',
  },
  ru: {
    welcomeHeadline: 'Общайтесь вживую с голосовым ИИ-агентом',
    startCall: 'Начать звонок',
    startAudio: 'Включить звук',
    agentListening: 'Агент слушает — спросите что угодно',
    language: 'Язык',
    conversationLanguage: 'Язык разговора',
    switchingLanguage: 'Смена языка…',
    controls: 'Управление голосовым ассистентом',
    toggleMic: 'Включить/выключить микрофон',
    muteMic: 'Выключить микрофон',
    unmuteMic: 'Включить микрофон',
    typeMessage: 'Введите сообщение или нажмите на микрофон, чтобы говорить…',
    toggleTranscript: 'Показать/скрыть расшифровку',
    transcript: 'Расшифровка',
    sendMessage: 'Отправить сообщение',
    sending: 'Отправка…',
    send: 'Отправить',
    endCall: 'Завершить звонок',
    skip: 'Пропустить',
    sessionEnded: 'Сессия завершена',
  },
};

function resolveLang(lang: string | undefined): LangCode {
  if (lang && lang in TRANSLATIONS) return lang as LangCode;
  if (DEFAULT_LANGUAGE in TRANSLATIONS) return DEFAULT_LANGUAGE as LangCode;
  return 'en';
}

/** Returns the string catalog for a language code (falls back to the default). */
export function tFor(lang: string | undefined): UIStrings {
  return TRANSLATIONS[resolveLang(lang)];
}

/** Returns the writing direction for a language code. */
export function getDir(lang: string | undefined): 'ltr' | 'rtl' {
  return RTL_LANGS.has(resolveLang(lang)) ? 'rtl' : 'ltr';
}
