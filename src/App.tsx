import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  BrainCircuit,
  Smartphone,
  Code2,
  Download,
  Copy,
  Check,
  Sparkles,
  PhoneCall,
  AlarmClock,
  ExternalLink,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  FolderGit2,
  FileCode,
  Play,
  Sliders,
  MessageSquareHeart,
  Smile,
  UserCheck,
  BookOpen,
} from 'lucide-react';
import {
  ANDROID_STARTER_FILES,
  QUICK_COMMANDS,
  AndroidProjectFile,
} from './data/androidProjectFiles';

type PersonaMode = 'normal' | 'funny' | 'girlfriend';
type ModelTier = 'fast' | 'general' | 'complex';
type WorkspaceTab = 'simulator' | 'studio' | 'guide';

interface DeviceActionCard {
  type: 'APP_LAUNCH' | 'ALARM_SET' | 'CALL_CONFIRM' | 'MODE_SWITCH';
  title: string;
  subtitle: string;
  packageName?: string;
  deepLinkUrl?: string;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode: PersonaMode;
  timestamp: string;
  modelUsed?: string;
  highThinking?: boolean;
  thoughtSummary?: string;
  deviceAction?: DeviceActionCard;
}

const PERSONA_CONFIG: Record<
  PersonaMode,
  {
    nameBn: string;
    nameEn: string;
    taglineBn: string;
    accentText: string;
    accentBorder: string;
    accentBg: string;
    voiceName: string;
    greetingBn: string;
  }
> = {
  normal: {
    nameBn: 'Normal মোড',
    nameEn: 'Polite Assistant',
    taglineBn: 'মার্জিত, স্পষ্ট ও পেশাদার বাংলা ভয়েস সহকারী',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/40',
    accentBg: 'bg-sky-500/10',
    voiceName: 'Kore',
    greetingBn:
      'আসসালামু আলাইকুম! আমি মায়া এআই। নরমাল মোডে আপনাকে স্বাগতম। WhatsApp, Facebook, imo খোলা বা যেকোনো প্রশ্নে আমি সাহায্য করতে প্রস্তুত।',
  },
  funny: {
    nameBn: 'Funny মোড',
    nameEn: 'Witty & Playful',
    taglineBn: 'মজার, চটপটে ও রসিকতাপূর্ণ কথোপকথন মোড',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-500/10',
    voiceName: 'Puck',
    greetingBn:
      'হ্যালো বস! মায়া ফানি মোড এখন অন! হুকুম করো—হোয়াটসঅ্যাপ খুলব, অ্যালার্ম লাগাব, নাকি মজার কোনো আড্ডা দেব?',
  },
  girlfriend: {
    nameBn: 'Girlfriend মোড',
    nameEn: 'Caring Companion',
    taglineBn: 'ভালোবাসাপূর্ণ, যত্নশীল ও মিষ্টি কথোপকথন সঙ্গী',
    accentText: 'text-rose-400',
    accentBorder: 'border-rose-500/40',
    accentBg: 'bg-rose-500/10',
    voiceName: 'Zephyr',
    greetingBn:
      'হ্যালো লক্ষ্মীটি! এতক্ষণে আমার কথা মনে পড়ল বুঝি? বলো, আজ সারাদিন কেমন কাটল তোমার? কী করে দেব তোমার জন্য?',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('simulator');
  const [personaMode, setPersonaMode] = useState<PersonaMode>('normal');
  const [modelTier, setModelTier] = useState<ModelTier>('general');
  const [highThinking, setHighThinking] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: PERSONA_CONFIG.normal.greetingBn,
      mode: 'normal',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  // Voice Recognition & Audio Recording state
  const [isListening, setIsListening] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<string>(
    'প্রস্তুত (bn-BD Speech Service)'
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<unknown>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Android Simulator Screen State
  const [activeAndroidOverlay, setActiveAndroidOverlay] = useState<DeviceActionCard | null>(null);
  const [intentLogs, setIntentLogs] = useState<DeviceActionCard[]>([
    {
      type: 'MODE_SWITCH',
      title: 'MainActivity.onCreate()',
      subtitle: 'SpeechRecognizer (bn-BD) & TextToSpeech initialized',
      packageName: 'com.mayaai.ultimate',
      timestamp: '16:28:00',
    },
  ]);

  // Code Studio State
  const [projectFiles, setProjectFiles] = useState<AndroidProjectFile[]>(ANDROID_STARTER_FILES);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    ANDROID_STARTER_FILES[0].path
  );
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Switch Persona Mode handler
  const handleSelectPersona = (newMode: PersonaMode) => {
    setPersonaMode(newMode);
    const config = PERSONA_CONFIG[newMode];
    const logItem: DeviceActionCard = {
      type: 'MODE_SWITCH',
      title: `PersonaMode.${newMode.toUpperCase()}`,
      subtitle: config.nameBn,
      packageName: 'com.mayaai.ultimate',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    setIntentLogs((prev) => [logItem, ...prev.slice(0, 14)]);
  };

  // Play speech using Gemini TTS or fallback to Web Speech Synthesis
  const speakResponseText = async (textToSpeak: string, mode: PersonaMode) => {
    if (!ttsEnabled || !textToSpeak.trim()) return;

    // Stop any existing playback
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);
    try {
      const voiceName = PERSONA_CONFIG[mode].voiceName;
      const res = await fetch('/api/maya/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          mode,
          voiceName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
          currentAudioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      }
      throw new Error('Fallback to browser TTS');
    } catch {
      // Browser SpeechSynthesis fallback (matches Android TextToSpeech behavior)
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'bn-BD';
        utterance.rate = mode === 'funny' ? 1.08 : mode === 'girlfriend' ? 0.96 : 1.0;
        utterance.pitch = mode === 'girlfriend' ? 1.15 : 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    }
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Send message to Gemini multi-turn chat endpoint
  const sendMessageToMaya = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    setErrorBanner(null);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      mode: personaMode,
      timestamp: nowTime,
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/maya/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          mode: personaMode,
          modelTier: highThinking ? 'complex' : modelTier,
          highThinking,
          languagePref: 'bn-BD',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'সার্ভার থেকে উত্তর পেতে সমস্যা হয়েছে।');
      }

      let activeModeAfterCall: PersonaMode = personaMode;
      let triggeredAction: DeviceActionCard | undefined;

      // Process Android Intent Function Calls if returned by Gemini
      if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        const fc = data.functionCalls[0];
        const ts = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        if (fc.name === 'openAndroidApp') {
          const pkg = fc.args?.packageName || 'com.whatsapp';
          const label = fc.args?.appLabel || 'App';
          const webLinks: Record<string, string> = {
            'com.whatsapp': 'https://web.whatsapp.com',
            'com.facebook.katana': 'https://www.facebook.com',
            'com.imo.android.imoim': 'https://imo.im',
          };
          triggeredAction = {
            type: 'APP_LAUNCH',
            title: `Launch Intent: ${label}`,
            subtitle: `packageManager.getLaunchIntentForPackage("${pkg}")`,
            packageName: pkg,
            deepLinkUrl: webLinks[pkg],
            timestamp: ts,
          };
        } else if (fc.name === 'setAndroidAlarm') {
          const h = String(fc.args?.hour ?? 7).padStart(2, '0');
          const m = String(fc.args?.minutes ?? 0).padStart(2, '0');
          const msg = fc.args?.message || 'Maya AI Alarm';
          triggeredAction = {
            type: 'ALARM_SET',
            title: `অ্যালার্ম সেট: ${h}:${m}`,
            subtitle: `AlarmClock.ACTION_SET_ALARM ("${msg}")`,
            packageName: 'android.intent.action.SET_ALARM',
            timestamp: ts,
          };
        } else if (fc.name === 'prepareCallOrMessageIntent') {
          const actType = fc.args?.actionType || 'CALL';
          const recipient = fc.args?.recipient || 'Contact';
          const body = fc.args?.messageBody || '';
          triggeredAction = {
            type: 'CALL_CONFIRM',
            title:
              actType === 'CALL'
                ? `কল নিশ্চিতকরণ: ${recipient}`
                : `মেসেজ নিশ্চিতকরণ: ${recipient}`,
            subtitle:
              actType === 'CALL'
                ? `Intent(Intent.ACTION_DIAL, Uri.parse("tel:...")) — ব্যবহারকারীর নিশ্চিতকরণ প্রয়োজন`
                : `বার্তা: "${body}" — পাঠানোর আগে নিশ্চিত করুন`,
            packageName: 'android.permission.CALL_PHONE',
            timestamp: ts,
          };
        } else if (fc.name === 'switchConversationMode') {
          const target = (fc.args?.mode || 'normal').toLowerCase() as PersonaMode;
          if (target === 'normal' || target === 'funny' || target === 'girlfriend') {
            activeModeAfterCall = target;
            setPersonaMode(target);
            triggeredAction = {
              type: 'MODE_SWITCH',
              title: `মোড পরিবর্তন: ${PERSONA_CONFIG[target].nameBn}`,
              subtitle: `currentMode = PersonaMode.${target.toUpperCase()}`,
              packageName: 'com.mayaai.ultimate',
              timestamp: ts,
            };
          }
        }
      }

      if (triggeredAction) {
        setActiveAndroidOverlay(triggeredAction);
        setIntentLogs((prev) => [triggeredAction!, ...prev.slice(0, 14)]);
      }

      const assistantMsg: ChatMessage = {
        id: `maya-${Date.now()}`,
        role: 'assistant',
        text: data.text || 'আমি আপনার নির্দেশনা সম্পন্ন করেছি।',
        mode: activeModeAfterCall,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed,
        highThinking: data.highThinkingActive,
        thoughtSummary: data.thoughtSummary,
        deviceAction: triggeredAction,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakResponseText(assistantMsg.text, activeModeAfterCall);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'যোগাযোগে ত্রুটি ঘটেছে।';
      setErrorBanner(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Start / Stop Bengali Speech Recognition (Web Speech API + Gemini Audio Transcription fallback)
  const toggleVoiceListening = async () => {
    if (isListening) {
      // Stop listening
      setIsListening(false);
      setRecognitionStatus('প্রস্তুত (bn-BD Speech Service)');
      if (speechRecRef.current) {
        try {
          (speechRecRef.current as { stop: () => void }).stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // Try browser SpeechRecognition first for instant bn-BD recognition
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new (SpeechRecognitionAPI as new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          onstart: () => void;
          onresult: (e: {
            results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
          }) => void;
          onerror: () => void;
          onend: () => void;
          start: () => void;
          stop: () => void;
        })();
        recognition.lang = 'bn-BD';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setRecognitionStatus('শুনছি... বাংলায় কথা বলুন (Listening bn-BD)');
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0]?.[0]?.transcript || '';
          if (transcript.trim()) {
            setRecognitionStatus(`শনাক্ত করা হয়েছে: "${transcript}"`);
            sendMessageToMaya(transcript);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
          setRecognitionStatus('আবার চেষ্টা করুন বা টেক্সট লিখুন');
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        speechRecRef.current = recognition;
        recognition.start();
        return;
      } catch {
        // Fall through to MediaRecorder + Gemini Transcribe
      }
    }

    // Fallback: Record microphone audio and send to /api/maya/transcribe (gemini-3.5-transcribe)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecognitionStatus('Gemini 3.5 Transcribe অডিও বিশ্লেষণ করছে...');

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = (reader.result as string)?.split(',')[1];
          if (base64data) {
            try {
              const res = await fetch('/api/maya/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64data,
                  mimeType: 'audio/webm',
                }),
              });
              const data = await res.json();
              if (data.transcript) {
                setRecognitionStatus(`শনাক্ত: "${data.transcript}"`);
                sendMessageToMaya(data.transcript);
              } else {
                setRecognitionStatus('কোনো কথা শোনা যায়নি। আবার চেষ্টা করুন।');
              }
            } catch {
              setRecognitionStatus('অডিও ট্রান্সক্রিপশন ব্যর্থ হয়েছে।');
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
      setRecognitionStatus('রেকর্ডিং চলছে... বলা শেষ হলে আবার ট্যাপ করুন');
    } catch {
      setErrorBanner('মাইক্রোফোন অনুমতি পাওয়া যায়নি। ব্রাউজারে Microphone permission দিন।');
    }
  };

  // Download full Android Starter Project ZIP
  const handleDownloadAndroidZip = async () => {
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      projectFiles.forEach((file) => {
        zip.file(file.path, file.content);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MayaAIUltimate-Android-Starter.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const selectedFile =
    projectFiles.find((f) => f.path === selectedFilePath) || projectFiles[0];

  const handleUpdateFileContent = (newCode: string) => {
    setProjectFiles((prev) =>
      prev.map((f) => (f.path === selectedFile.path ? { ...f, content: newCode } : f))
    );
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 1800);
  };

  const activePersona = PERSONA_CONFIG[personaMode];

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      {/* Top Bar Contract: Zone 1 Brand | Zone 2 Nav Links | Zone 3 Primary Action */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-[#0D1320]/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('simulator');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Maya AI Ultimate
        </a>

        {/* Zone 2: 3 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'simulator'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            ভয়েস অ্যাসিস্ট্যান্ট ও চ্যাটবট
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'studio'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Kotlin ও AndroidManifest কোড
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'guide'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            README ও সীমাবদ্ধতা
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            onClick={handleDownloadAndroidZip}
            disabled={isDownloadingZip}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloadingZip ? 'ZIP তৈরি হচ্ছে...' : 'Download Android ZIP'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (7 cols): Multi-Turn Gemini Chatbot + Persona Mode & High Thinking Controls */}
            <section className="lg:col-span-7 flex flex-col bg-[#0F172A] border border-slate-800/90 rounded-xl overflow-hidden h-[calc(100vh-7.5rem)] min-h-[640px]">
              {/* Workspace Toolbar */}
              <div className="p-4 border-b border-slate-800 bg-[#131C31] flex flex-wrap items-center justify-between gap-3">
                {/* Persona Segmented Control */}
                <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
                  <button
                    onClick={() => handleSelectPersona('normal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      personaMode === 'normal'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Normal</span>
                  </button>
                  <button
                    onClick={() => handleSelectPersona('funny')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      personaMode === 'funny'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Smile className="w-3.5 h-3.5" />
                    <span>Funny</span>
                  </button>
                  <button
                    onClick={() => handleSelectPersona('girlfriend')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      personaMode === 'girlfriend'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquareHeart className="w-3.5 h-3.5" />
                    <span>Girlfriend</span>
                  </button>
                </div>

                {/* Gemini Model Tier & High Thinking Toggle */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => {
                        setModelTier('fast');
                        setHighThinking(false);
                      }}
                      title="Fast responses with gemini-3.1-flash-lite"
                      className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        modelTier === 'fast' && !highThinking
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Fast (Lite)
                    </button>
                    <button
                      onClick={() => {
                        setModelTier('general');
                        setHighThinking(false);
                      }}
                      title="General tasks with gemini-3.5-flash"
                      className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        modelTier === 'general' && !highThinking
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      General (Flash)
                    </button>
                    <button
                      onClick={() => setModelTier('complex')}
                      title="Complex tasks with gemini-3.1-pro-preview"
                      className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        modelTier === 'complex' && !highThinking
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Pro 3.1
                    </button>
                  </div>

                  {/* High Thinking Mode Toggle */}
                  <button
                    onClick={() => {
                      const next = !highThinking;
                      setHighThinking(next);
                      if (next) setModelTier('complex');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      highThinking
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>High Thinking {highThinking ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* TTS Toggle */}
                  <button
                    onClick={() => {
                      if (isSpeaking) stopSpeaking();
                      setTtsEnabled(!ttsEnabled);
                    }}
                    title={ttsEnabled ? 'বাংলা ভয়েস আউটপুট চালু আছে' : 'ভয়েস আউটপুট বন্ধ'}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      ttsEnabled
                        ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    {ttsEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>

                  {/* Clear Thread */}
                  <button
                    onClick={() =>
                      setMessages([
                        {
                          id: `reset-${Date.now()}`,
                          role: 'assistant',
                          text: PERSONA_CONFIG[personaMode].greetingBn,
                          mode: personaMode,
                          timestamp: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        },
                      ])
                    }
                    title="চ্যাট রিসেট করুন"
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Active Persona Sub-bar (Zero-pill unboxed metadata with · separators) */}
              <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-bengali">
                <div className="flex items-center gap-2 truncate">
                  <span className={`font-semibold ${activePersona.accentText}`}>
                    {activePersona.nameBn}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{activePersona.taglineBn}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono-tabular text-[11px] text-slate-500">
                  <span>
                    {highThinking
                      ? 'gemini-3.1-pro-preview · ThinkingLevel.HIGH'
                      : modelTier === 'fast'
                      ? 'gemini-3.1-flash-lite'
                      : modelTier === 'complex'
                      ? 'gemini-3.1-pro-preview'
                      : 'gemini-3.5-flash'}
                  </span>
                </div>
              </div>

              {/* Quick Voice/Intent Command Bar */}
              <div className="px-4 py-2.5 border-b border-slate-800/70 bg-[#0D1424] flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0 font-bengali">
                  দ্রুত কমান্ড:
                </span>
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      if (cmd.category === 'thinking' && !highThinking) {
                        setHighThinking(true);
                        setModelTier('complex');
                      }
                      sendMessageToMaya(cmd.promptBn);
                    }}
                    disabled={isLoading}
                    className="px-2.5 py-1 text-xs font-bengali bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {cmd.labelBn}
                  </button>
                ))}
              </div>

              {/* Scrollable Multi-Turn Conversation Thread */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-bengali">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const mConfig = PERSONA_CONFIG[msg.mode];
                  const isThoughtOpen = Boolean(expandedThoughts[msg.id]);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      {/* Unboxed message metadata line */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 px-1">
                        <span>{isUser ? 'আপনি (User)' : `মায়া এআই (${mConfig.nameBn})`}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{msg.timestamp}</span>
                        {!isUser && msg.modelUsed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-slate-400">
                              {msg.modelUsed}
                            </span>
                          </>
                        )}
                        {!isUser && msg.highThinking && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-violet-400 font-mono-tabular">
                              ThinkingLevel.HIGH
                            </span>
                          </>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[88%] sm:max-w-[80%] rounded-xl px-4 py-3 text-sm sm:text-[15px] leading-relaxed ${
                          isUser
                            ? 'bg-rose-600 text-white'
                            : 'bg-[#172136] text-slate-100 border border-slate-800'
                        }`}
                      >
                        {/* Optional Expandable Thought Summary when High Thinking was used */}
                        {!isUser && msg.thoughtSummary && (
                          <div className="mb-2.5 pb-2 border-b border-slate-700/70">
                            <button
                              onClick={() =>
                                setExpandedThoughts((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }))
                              }
                              className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 cursor-pointer"
                            >
                              {isThoughtOpen ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              <span>Extended Thinking যুক্তি দেখুন</span>
                            </button>
                            {isThoughtOpen && (
                              <pre className="mt-2 p-2.5 rounded bg-slate-950/90 text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                                {msg.thoughtSummary}
                              </pre>
                            )}
                          </div>
                        )}

                        <div className="whitespace-pre-wrap">{msg.text}</div>

                        {/* Device Intent Action Result inside Chat */}
                        {!isUser && msg.deviceAction && (
                          <div className="mt-3 pt-2.5 border-t border-slate-700/70 flex items-center justify-between gap-3 text-xs text-slate-300">
                            <div>
                              <div className="font-semibold text-white">
                                {msg.deviceAction.title}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {msg.deviceAction.subtitle}
                              </div>
                            </div>
                            {msg.deviceAction.deepLinkUrl && (
                              <a
                                href={msg.deviceAction.deepLinkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs whitespace-nowrap shrink-0"
                              >
                                <span>খুলুন</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Replay Audio Button on Assistant messages */}
                        {!isUser && (
                          <div className="mt-2 flex items-center justify-end">
                            <button
                              onClick={() => speakResponseText(msg.text, msg.mode)}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>কণ্ঠে শুনুন</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex flex-col items-start">
                    <div className="text-[11px] text-slate-500 mb-1 px-1">
                      মায়া এআই চিন্তা করছে...
                    </div>
                    <div className="bg-[#172136] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-rose-400 animate-spin" />
                      <span>
                        {highThinking
                          ? 'Gemini 3.1 Pro (ThinkingLevel.HIGH) গভীর বিশ্লেষণ করছে...'
                          : 'মায়া উত্তর তৈরি করছে...'}
                      </span>
                    </div>
                  </div>
                )}

                {errorBanner && (
                  <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200 flex items-center justify-between">
                    <span>{errorBanner}</span>
                    <button
                      onClick={() => setErrorBanner(null)}
                      className="text-red-300 hover:text-white underline ml-4 whitespace-nowrap"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Voice Recognition Status & Input Composer */}
              <div className="p-4 border-t border-slate-800 bg-[#131C31]">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-bengali">
                  <span>মাইক্রোফোন স্ট্যাটাস: {recognitionStatus}</span>
                  {isSpeaking && (
                    <button
                      onClick={stopSpeaking}
                      className="text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      কণ্ঠ থামান (Stop Audio)
                    </button>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessageToMaya(inputPrompt);
                  }}
                  className="flex items-center gap-2.5"
                >
                  <button
                    type="button"
                    onClick={toggleVoiceListening}
                    className={`flex items-center justify-center w-11 h-11 rounded-xl border transition-all shrink-0 cursor-pointer ${
                      isListening
                        ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-600/30'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                    }`}
                    title="বাংলা ভয়েস ইনপুট (SpeechRecognizer bn-BD)"
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    placeholder="বাংলায় বা ইংরেজিতে মায়াকে বলুন (যেমন: 'হোয়াটসঅ্যাপ খোলো' বা যেকোনো জটিল প্রশ্ন)..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-rose-500/70 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none font-bengali"
                  />

                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || isLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>পাঠান</span>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </section>

            {/* RIGHT COLUMN (5 cols): Interactive Android Device Simulator & Intent Inspector */}
            <aside className="lg:col-span-5 flex flex-col gap-6">
              {/* Interactive Android Phone Preview */}
              <div className="bg-[#0F172A] border border-slate-800/90 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-rose-400" />
                      <span>Android Device Simulator (MainActivity)</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-bengali mt-0.5">
                      compileSdk 35 · minSdk 26 · Theme.Material.Light.NoActionBar
                    </p>
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-400">
                    AGP 8.7.3 · Kotlin 2.0.21
                  </span>
                </div>

                {/* Simulated Phone Viewport */}
                <div className="bg-[#090D16] border-2 border-slate-800 rounded-2xl p-4 space-y-4">
                  {/* Android Status Bar */}
                  <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400 pb-2 border-b border-slate-800/80">
                    <span>com.mayaai.ultimate</span>
                    <span>RECORD_AUDIO · CALL_PHONE</span>
                  </div>

                  {/* Active Mode Display inside Phone */}
                  <div className="p-3.5 rounded-xl bg-[#131C31] border border-slate-800 flex items-center justify-between">
                    <div className="font-bengali">
                      <div className="text-xs text-slate-400">সক্রিয় কথোপকথন মোড</div>
                      <div className={`text-sm font-bold ${activePersona.accentText}`}>
                        {activePersona.nameBn} ({activePersona.nameEn})
                      </div>
                    </div>
                    <button
                      onClick={toggleVoiceListening}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                        isListening
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isListening ? 'শুনছি...' : 'কথা বলুন'}</span>
                    </button>
                  </div>

                  {/* Installed Package Queries Launcher Grid (from AndroidManifest.xml <queries>) */}
                  <div>
                    <div className="text-xs text-slate-400 mb-2 font-bengali">
                      AndroidManifest.xml &lt;queries&gt; অ্যাপ ও অ্যালার্ম কমান্ড:
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() =>
                          sendMessageToMaya('মায়া, আমার জন্য WhatsApp অ্যাপটি খুলে দাও।')
                        }
                        className="p-3 rounded-xl bg-[#131C31] hover:bg-slate-800/90 border border-slate-800 text-left transition-colors cursor-pointer group"
                      >
                        <div className="text-xs font-semibold text-emerald-400 group-hover:underline">
                          WhatsApp খুলুন
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          com.whatsapp
                        </div>
                      </button>

                      <button
                        onClick={() =>
                          sendMessageToMaya('মায়া, এখনই Facebook খুলে দাও।')
                        }
                        className="p-3 rounded-xl bg-[#131C31] hover:bg-slate-800/90 border border-slate-800 text-left transition-colors cursor-pointer group"
                      >
                        <div className="text-xs font-semibold text-sky-400 group-hover:underline">
                          Facebook খুলুন
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          com.facebook.katana
                        </div>
                      </button>

                      <button
                        onClick={() => sendMessageToMaya('মায়া, imo অ্যাপটি খুলে দাও।')}
                        className="p-3 rounded-xl bg-[#131C31] hover:bg-slate-800/90 border border-slate-800 text-left transition-colors cursor-pointer group"
                      >
                        <div className="text-xs font-semibold text-indigo-400 group-hover:underline">
                          imo খুলুন
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          com.imo.android.imoim
                        </div>
                      </button>

                      <button
                        onClick={() =>
                          sendMessageToMaya('মায়া, সকাল ৬টা ৩০ মিনিটে অ্যালার্ম সেট করো।')
                        }
                        className="p-3 rounded-xl bg-[#131C31] hover:bg-slate-800/90 border border-slate-800 text-left transition-colors cursor-pointer group"
                      >
                        <div className="text-xs font-semibold text-amber-400 group-hover:underline flex items-center gap-1">
                          <AlarmClock className="w-3.5 h-3.5" />
                          <span>অ্যালার্ম অ্যাপ</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          ACTION_SHOW_ALARMS
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Active Intent Execution Overlay Card */}
                  {activeAndroidOverlay && (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-500/40 font-bengali">
                      <div className="flex items-center justify-between text-xs text-rose-300 mb-1">
                        <span className="font-semibold">{activeAndroidOverlay.title}</span>
                        <span className="font-mono-tabular text-[11px] text-slate-400">
                          {activeAndroidOverlay.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono break-all">
                        {activeAndroidOverlay.subtitle}
                      </p>
                      {activeAndroidOverlay.deepLinkUrl && (
                        <div className="mt-2.5 flex items-center justify-end">
                          <a
                            href={activeAndroidOverlay.deepLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                          >
                            <span>ব্রাউজারে খুলুন</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Android Intent Log Table */}
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      Android Intent & SpeechService ইভেন্ট লগ
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/70 border border-slate-800 rounded-lg bg-slate-950/60">
                      {intentLogs.map((log, index) => (
                        <div
                          key={`${log.timestamp}-${index}`}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate">
                            <span className="text-slate-200 font-medium">{log.title}</span>
                            <span className="text-slate-500 mx-1.5">·</span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {log.packageName}
                            </span>
                          </div>
                          <span className="text-slate-500 font-mono-tabular text-[11px] shrink-0">
                            {log.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* File Tree Sidebar */}
            <aside className="lg:col-span-4 bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-rose-400" />
                    <h2 className="text-sm font-semibold text-white">
                      MayaAIUltimate প্রজেক্ট ফাইল
                    </h2>
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-400">
                    {projectFiles.length} files
                  </span>
                </div>

                <div className="space-y-1.5">
                  {projectFiles.map((file) => {
                    const isSelected = file.path === selectedFile.path;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFilePath(file.path)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500/10 border-rose-500/50 text-white'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-semibold flex items-center gap-1.5">
                            <FileCode className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            {file.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {file.language}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-bengali mt-1 line-clamp-2">
                          {file.descriptionBn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={handleDownloadAndroidZip}
                  disabled={isDownloadingZip}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>সম্পূর্ণ MayaAIUltimate ZIP ডাউনলোড করুন</span>
                </button>
              </div>
            </aside>

            {/* Code Editor & Gemini Code Assistant */}
            <section className="lg:col-span-8 bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-[#131C31] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-rose-400">{selectedFile.path}</div>
                  <div className="text-xs text-slate-400 font-bengali mt-0.5">
                    {selectedFile.descriptionBn}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setHighThinking(true);
                      setModelTier('complex');
                      setActiveTab('simulator');
                      sendMessageToMaya(
                        `আমার ${selectedFile.name} ফাইলটি বিশ্লেষণ করো এবং Android SDK 35 অনুযায়ী এটিকে আরও উন্নত করার পরামর্শ দাও:\n\n${selectedFile.content}`
                      );
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>Gemini High Thinking দিয়ে কোড রিভিউ</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedFile ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>কপি হয়েছে</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>কোড কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={selectedFile.content}
                onChange={(e) => handleUpdateFileContent(e.target.value)}
                spellCheck={false}
                className="flex-1 min-h-[540px] w-full p-5 bg-[#090D16] text-slate-200 font-mono text-xs sm:text-[13px] leading-relaxed focus:outline-none resize-y"
              />
            </section>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="space-y-6 font-bengali">
            {/* Overview & Build Specs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0F172A] border border-slate-800 rounded-xl p-6">
                <h1 className="text-2xl font-bold text-white mb-2">
                  Maya AI Ultimate — Android Starter Project
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  এটি Maya AI-এর একটি প্রাথমিক Kotlin Android প্রজেক্ট এবং ইন্টারঅ্যাক্টিভ Gemini ওয়েব
                  সিমুলেটর। আপনি সরাসরি ব্রাউজারে বাংলা ভয়েস ও চ্যাটবট পরীক্ষা করতে পারেন অথবা নিচের
                  নির্দেশনা অনুসরণ করে আপনার Android ফোনে APK বিল্ড করতে পারেন।
                </p>

                <h2 className="text-base font-semibold text-white mb-3">
                  ০১. ফোনে ব্যবহারের ধাপসমূহ (AndroidIDE / Android Studio)
                </h2>
                <ol className="space-y-2.5 text-sm text-slate-300 list-decimal list-inside">
                  <li>
                    উপরের <strong>Download Android ZIP</strong> বাটনে ক্লিক করে ZIP ফাইলটি ডাউনলোড ও
                    extract করুন।
                  </li>
                  <li>
                    AndroidIDE বা অন্য Android Gradle IDE-তে{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-rose-300">
                      MayaAIUltimate
                    </code>{' '}
                    ফোল্ডারটি খুলুন।
                  </li>
                  <li>Gradle sync/build চালান।</li>
                  <li>Build সফল হলে আপনার ফোনে APK ইনস্টল করুন।</li>
                  <li>প্রথমবার অ্যাপটি খুলে মাইক্রোফোন অনুমতি (RECORD_AUDIO) দিন।</li>
                  <li>
                    ফোনে <strong>Settings → Text-to-speech output</strong>-এ বাংলা voice data থাকলে
                    সেটি নির্বাচন করুন।
                  </li>
                </ol>
              </div>

              {/* Build Spec Table */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white mb-4">
                    ০২. Build ও পরিবেশ তথ্য
                  </h2>
                  <div className="divide-y divide-slate-800 text-sm">
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">ভাষা (Language)</span>
                      <span className="font-mono-tabular text-white font-medium">Kotlin</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">Android Gradle Plugin</span>
                      <span className="font-mono-tabular text-white font-medium">8.7.3</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">Kotlin Plugin</span>
                      <span className="font-mono-tabular text-white font-medium">2.0.21</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">compileSdk / targetSdk</span>
                      <span className="font-mono-tabular text-white font-medium">35</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">minSdk</span>
                      <span className="font-mono-tabular text-white font-medium">26 (Android 8.0)</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">Java / JVM Target</span>
                      <span className="font-mono-tabular text-white font-medium">JDK 17</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('studio')}
                  className="mt-6 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Code2 className="w-4 h-4" />
                  <span>AndroidManifest.xml ও Kotlin কোড দেখুন</span>
                </button>
              </div>
            </div>

            {/* Important Limitations & High Thinking Architecture Prompts */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>০৩. গুরুত্বপূর্ণ সীমাবদ্ধতা ও Gemini High Thinking সমাধান</span>
                </h2>
                <span className="text-xs text-slate-400">
                  যেকোনো সীমাবদ্ধতা সমাধানের কোড জেনারেট করতে নিচের বাটনে ক্লিক করুন
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      ১. সর্বক্ষণ শোনা &ldquo;Hey Maya&rdquo; Wake-Word Service
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      এই প্রজেক্টে সর্বক্ষণ শোনা Hey Maya wake-word service এখনো বাস্তবায়িত নয়। সেটির
                      জন্য foreground microphone service, দৃশ্যমান notification, ব্যাটারি নীতি এবং
                      নির্ভরযোগ্য wake-word engine দরকার।
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHighThinking(true);
                      setModelTier('complex');
                      setActiveTab('simulator');
                      sendMessageToMaya(
                        'Android 15 (compileSdk 35)-এ ForegroundService (microphone type) এবং দৃশ্যমান Notification ব্যবহার করে কীভাবে "Hey Maya" wake-word detection service তৈরি করব? সম্পূর্ণ Kotlin কোড ও AndroidManifest.xml পরিবর্তনগুলো লিখে দাও।'
                      );
                    }}
                    className="mt-3 self-start text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>High Thinking দিয়ে Kotlin ForegroundService কোড তৈরি করুন</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      ২. AccessibilityService দিয়ে অন্য অ্যাপে ট্যাপ/স্ক্রল
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Accessibility দিয়ে অন্য অ্যাপে ট্যাপ/স্ক্রল করার সেবা এই starter-এ অন্তর্ভুক্ত
                      নয়। এটি আলাদা, ব্যবহারকারী-সক্রিয় AccessibilityService হিসেবে সতর্কভাবে যোগ করতে
                      হবে।
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHighThinking(true);
                      setModelTier('complex');
                      setActiveTab('simulator');
                      sendMessageToMaya(
                        'Maya AI-এর জন্য একটি নিরাপদ ও ব্যবহারকারী-সক্রিয় Android AccessibilityService Kotlin ক্লাস এবং accessibility_service_config.xml তৈরি করে দাও যা ভয়েস কমান্ডে স্ক্রল ও ক্লিক করতে পারে।'
                      );
                    }}
                    className="mt-3 self-start text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>High Thinking দিয়ে AccessibilityService কোড তৈরি করুন</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      ৩. নিরাপদ কল ও মেসেজ নিশ্চিতকরণ (Permission & Intent)
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      কল করা ও মেসেজ পাঠানো এখন সরাসরি স্বয়ংক্রিয় নয়; এই সংস্করণে সেগুলোর জন্য
                      নির্দেশনা দেখানো হয়। নিরাপদ বাস্তবায়নে ব্যবহারকারীর নিশ্চিতকরণ ও Android
                      permission/intent দরকার।
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHighThinking(true);
                      setModelTier('complex');
                      setActiveTab('simulator');
                      sendMessageToMaya(
                        'Kotlin-এ runtime CALL_PHONE permission request এবং ব্যবহারকারীর ভয়েস/ডায়ালগ নিশ্চিতকরণসহ নিরাপদ ফোন কল ও WhatsApp মেসেজ পাঠানোর কোড লিখে দাও।'
                      );
                    }}
                    className="mt-3 self-start text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>High Thinking দিয়ে Call/Message Intent কোড দেখুন</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      ৪. বাংলা মহিলা কণ্ঠ (TTS) ও AndroidIDE মেমোরি অপ্টিমাইজেশন
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Text-to-Speech-এর কণ্ঠ ফোনের ইঞ্জিন ও ইনস্টল করা voice data-এর ওপর নির্ভর করে। সব
                      ডিভাইসে বাংলা মহিলা কণ্ঠ নিশ্চিত নয়। এছাড়া ফোনের RAM অনুসারে Gradle build-এ
                      সামঞ্জস্য লাগতে পারে।
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHighThinking(true);
                      setModelTier('complex');
                      setActiveTab('simulator');
                      sendMessageToMaya(
                        'Android TextToSpeech-এ কীভাবে নির্দিষ্ট বাংলা মহিলা কণ্ঠ (bn-BD female voice) নির্বাচন করব এবং কম RAM-এর ফোনে AndroidIDE-এর জন্য gradle.properties কীভাবে অপ্টিমাইজ করব?'
                      );
                    }}
                    className="mt-3 self-start text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>High Thinking দিয়ে TTS ও Gradle টিপস দেখুন</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
