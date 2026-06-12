let recognition = null;

export const initSpeechRecognition = (lang = 'fa-IR') => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech Recognition API در این مرورگر پشتیبانی نمی‌شود');
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 3;

  return recognition;
};

export const startListening = (onResult, onEnd, onError) => {
  if (!recognition) {
    onError?.('مرورگر شما از تشخیص گفتار پشتیبانی نمی‌کند.');
    return;
  }

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    onResult(finalTranscript.trim(), interimTranscript.trim());
  };

  recognition.onend = () => {
    onEnd?.();
  };

  recognition.onerror = (event) => {
    onError?.(`خطا: ${event.error}`);
  };

  try {
    recognition.start();
  } catch {
    onError?.('خطا در شروع تشخیص گفتار. لطفاً دوباره تلاش کنید.');
  }
};

export const stopListening = () => {
  if (recognition) {
    recognition.stop();
  }
};

export const isSpeechSupported = () => {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
};
