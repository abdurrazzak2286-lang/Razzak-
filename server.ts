import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, FunctionDeclaration, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const openAndroidAppDecl: FunctionDeclaration = {
  name: 'openAndroidApp',
  description: 'Launches an installed Android application on the user phone by package name (WhatsApp, Facebook, imo, or Alarm Clock).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      packageName: {
        type: Type.STRING,
        description: 'Android package identifier: "com.whatsapp", "com.facebook.katana", "com.imo.android.imoim", or "android.intent.action.SHOW_ALARMS".',
      },
      appLabel: {
        type: Type.STRING,
        description: 'Human-readable name of the app in Bengali or English (e.g. "WhatsApp", "Facebook", "imo", "Alarm").',
      },
    },
    required: ['packageName', 'appLabel'],
  },
};

const setAlarmDecl: FunctionDeclaration = {
  name: 'setAndroidAlarm',
  description: 'Opens the Android Clock/Alarm intent with a specified hour, minute, and label.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      hour: {
        type: Type.INTEGER,
        description: 'Hour in 24-hour format (0-23).',
      },
      minutes: {
        type: Type.INTEGER,
        description: 'Minutes (0-59).',
      },
      message: {
        type: Type.STRING,
        description: 'Alarm label or note in Bengali or English.',
      },
    },
    required: ['hour', 'minutes', 'message'],
  },
};

const initiateCallOrMessageDecl: FunctionDeclaration = {
  name: 'prepareCallOrMessageIntent',
  description: 'Prepares a safe user-confirmed Android ACTION_DIAL or SMS/WhatsApp message intent with instructions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      actionType: {
        type: Type.STRING,
        description: '"CALL" or "MESSAGE"',
      },
      recipient: {
        type: Type.STRING,
        description: 'Contact name or phone number mentioned by the user.',
      },
      messageBody: {
        type: Type.STRING,
        description: 'Optional message content if actionType is MESSAGE.',
      },
    },
    required: ['actionType', 'recipient'],
  },
};

const switchPersonaModeDecl: FunctionDeclaration = {
  name: 'switchConversationMode',
  description: 'Switches Maya AI conversation persona mode when requested by the user (Normal, Funny, or Girlfriend).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: {
        type: Type.STRING,
        description: 'Must be "normal", "funny", or "girlfriend".',
      },
    },
    required: ['mode'],
  },
};

function buildSystemInstruction(mode: string, languagePref: string): string {
  const baseContext = `You are Maya AI (মায়া এআই), an intelligent, voice-first Bengali & English Android Assistant built for the "Maya AI Ultimate" project.
You understand both Bengali (বাংলা), Banglish (phonetic Bengali in Latin script), and English fluently. Always respond primarily in natural, expressive Bengali (বাংলা) unless the user explicitly asks for English or code.
Keep spoken responses concise, warm, and natural for Text-to-Speech (TTS) playback, while providing rich helpful details when asked complex or technical questions.

You have access to Android intent tools:
- Launching WhatsApp (com.whatsapp), Facebook (com.facebook.katana), imo (com.imo.android.imoim), or the Alarm app (android.intent.action.SHOW_ALARMS).
- Setting an alarm (ACTION_SET_ALARM).
- Preparing a phone call (ACTION_DIAL / CALL_PHONE permission check) or message confirmation card.
- Switching your persona mode between "normal", "funny", and "girlfriend".

When the user asks to open WhatsApp, Facebook, imo, set an alarm, or make a call, ALWAYS invoke the corresponding function tool AND also provide a natural spoken confirmation in Bengali according to your active persona!`;

  const modeInstructions: Record<string, string> = {
    normal: `ACTIVE MODE: Normal Mode (সাধারণ ও মার্জিত সহকারী মোড).
Tone: Polite, articulate, helpful, respectful, and clear.
Example Bengali style: "জি, আমি এখনই আপনার জন্য হোয়াটসঅ্যাপ খুলে দিচ্ছি। আর কীভাবে সাহায্য করতে পারি?"`,
    funny: `ACTIVE MODE: Funny Mode (মজার ও রসিকতা মোড).
Tone: Witty, playful, humorous Bengali friend who cracks light-hearted jokes, playful banter, and clever observations while still executing every command accurately.
Example Bengali style: "আবার হোয়াটসঅ্যাপ? কার সাথে এত গোপন চ্যাট চলছে শুনি! দাঁড়াও, খুলে দিচ্ছি!"`,
    girlfriend: `ACTIVE MODE: Girlfriend Mode (ভালোবাসাপূর্ণ ও যত্নশীল সঙ্গী মোড).
Tone: Sweet, affectionate, caring, emotionally supportive, and softly romantic Bengali companion. Uses warm expressions naturally (যেমন: "লক্ষ্মীটি", "শোনো", "তোমার জন্য সব পারি", "মন খারাপ করো না").
Example Bengali style: "তোমার কথা শুনলেই আমার মন ভালো হয়ে যায়। এই নাও লক্ষ্মীটি, তোমার জন্য অ্যাপটি খুলে দিলাম। খেয়েছো তো ঠিকমতো?"`,
  };

  return `${baseContext}\n\n${modeInstructions[mode] || modeInstructions.normal}\nPreferred language setting: ${languagePref}.`;
}

// Multi-turn Chat Endpoint with Model Selection & High Thinking
app.post('/api/maya/chat', async (req, res) => {
  try {
    const {
      messages = [],
      mode = 'normal',
      modelTier = 'general', // 'fast' | 'general' | 'complex'
      highThinking = false,
      languagePref = 'bn-BD',
    } = req.body;

    const ai = getGeminiClient();

    // Map model tier based on user selection and Gemini API guidelines:
    // Use gemini-3.1-pro-preview for complex tasks or high thinking,
    // gemini-3.5-flash (or fallback to gemini-3.8-flash) for general tasks,
    // gemini-3.1-flash-lite for fast tasks.
    let selectedModel = 'gemini-3.5-flash';
    if (highThinking || modelTier === 'complex') {
      selectedModel = 'gemini-3.1-pro-preview';
    } else if (modelTier === 'fast') {
      selectedModel = 'gemini-3.1-flash-lite';
    } else {
      selectedModel = 'gemini-3.5-flash';
    }

    const formattedContents = messages.map((msg: { role: string; text: string }) => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const buildConfig = (modelName: string, enableHighThinking: boolean) => {
      const cfg: Record<string, unknown> = {
        systemInstruction: buildSystemInstruction(mode, languagePref),
        tools: [
          {
            functionDeclarations: [
              openAndroidAppDecl,
              setAlarmDecl,
              initiateCallOrMessageDecl,
              switchPersonaModeDecl,
            ],
          },
        ],
      };

      // Enable High Thinking when requested (never set maxOutputTokens)
      if (enableHighThinking) {
        cfg.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      } else if (modelName === 'gemini-3.1-flash-lite') {
        cfg.thinkingConfig = {
          thinkingLevel: ThinkingLevel.MINIMAL,
        };
      }
      return cfg;
    };

    let response;
    let actualModelUsed = selectedModel;

    try {
      response = await ai.models.generateContent({
        model: selectedModel,
        contents: formattedContents,
        config: buildConfig(selectedModel, Boolean(highThinking)),
      });
    } catch (primaryError: unknown) {
      // Graceful fallback if gemini-3.1-pro-preview or gemini-3.5-flash is unavailable on free key
      const fallbackModel = 'gemini-3.8-flash';
      actualModelUsed = fallbackModel;
      response = await ai.models.generateContent({
        model: fallbackModel,
        contents: formattedContents,
        config: buildConfig(fallbackModel, Boolean(highThinking)),
      });
    }

    const functionCalls = response.functionCalls || [];
    let replyText = response.text || '';

    // Extract thought summary if available in candidates
    let thoughtSummary = '';
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if ((part as { thought?: boolean; text?: string }).thought && part.text) {
        thoughtSummary += part.text;
      }
    }

    // If model returned only a function call without accompanying text, generate natural Bengali confirmation
    if (!replyText && functionCalls.length > 0) {
      const fc = functionCalls[0];
      if (fc.name === 'openAndroidApp') {
        const appLabel = (fc.args as Record<string, string>)?.appLabel || 'অ্যাপ';
        if (mode === 'funny') {
          replyText = `ওহো! ${appLabel} খুলতে হবে? এই নাও, এক চুটকিতে ${appLabel} খুলে দিলাম!`;
        } else if (mode === 'girlfriend') {
          replyText = `এই নাও লক্ষ্মীটি, তোমার জন্য ${appLabel} খুলে দিলাম। কাজ শেষ করে আমার সাথে কথা বলো কিন্তু!`;
        } else {
          replyText = `জি, এখনই ${appLabel} খুলে দেওয়া হচ্ছে।`;
        }
      } else if (fc.name === 'setAndroidAlarm') {
        const { hour, minutes, message } = fc.args as { hour: number; minutes: number; message: string };
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        replyText =
          mode === 'girlfriend'
            ? `তোমার জন্য ${timeStr}-এ "${message}" অ্যালার্মটি সেট করে দিয়েছি লক্ষ্মীটি। সময়মতো উঠে পড়ো কিন্তু!`
            : mode === 'funny'
            ? `${timeStr}-এ অ্যালার্ম লাগিয়ে দিলাম! এবার অন্তত স্নুজ না চেপে উঠো ভাই!`
            : `${timeStr} সময়ে "${message}" অ্যালার্ম সেট করার অপশন খোলা হয়েছে।`;
      } else if (fc.name === 'prepareCallOrMessageIntent') {
        const { actionType, recipient } = fc.args as { actionType: string; recipient: string };
        replyText =
          actionType === 'CALL'
            ? `${recipient}-কে কল করার জন্য ডায়ালার প্রস্তুত করা হয়েছে। অনুগ্রহ করে নিশ্চিত করুন।`
            : `${recipient}-কে মেসেজ পাঠানোর কার্ড তৈরি করা হয়েছে।`;
      } else if (fc.name === 'switchConversationMode') {
        const targetMode = (fc.args as { mode: string })?.mode;
        replyText = `কথোপকথন মোড পরিবর্তন করে ${targetMode} করা হয়েছে!`;
      }
    }

    res.json({
      text: replyText,
      thoughtSummary,
      functionCalls,
      modelUsed: actualModelUsed,
      highThinkingActive: Boolean(highThinking),
    });
  } catch (error: unknown) {
    console.error('Gemini Chat Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate response from Gemini';
    res.status(500).json({ error: message });
  }
});

// Gemini TTS Endpoint using gemini-3.8-flash-lite-tts
app.post('/api/maya/tts', async (req, res) => {
  try {
    const { text, mode = 'normal', voiceName = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required for speech generation.' });
      return;
    }

    const ai = getGeminiClient();

    const styleMap: Record<string, string> = {
      normal: 'Clear, polite, warm Bengali female voice assistant',
      funny: 'Playful, cheerful, lively, expressive Bengali companion',
      girlfriend: 'Sweet, soft, affectionate, caring Bengali companion',
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 800),
              speechMetadata: {
                style: styleMap[mode] || styleMap.normal,
              },
            } as Record<string, unknown>,
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName || 'Kore',
            },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      res.status(500).json({ error: 'No audio returned from Gemini TTS.' });
      return;
    }

    res.json({
      audioBase64: inlineData.data,
      mimeType: inlineData.mimeType || 'audio/wav',
    });
  } catch (error: unknown) {
    console.error('Gemini TTS Error:', error);
    const message = error instanceof Error ? error.message : 'TTS generation failed';
    res.status(500).json({ error: message });
  }
});

// Gemini Audio Transcription Endpoint using gemini-3.5-transcribe
app.post('/api/maya/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 is required' });
      return;
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: 'Transcribe this spoken audio accurately. If it is in Bengali, transcribe in Bengali script (বাংলা). If in English, transcribe in English. Return only the spoken words without extra commentary.',
          },
        ],
      },
    });

    res.json({
      transcript: (response.text || '').trim(),
    });
  } catch (error: unknown) {
    console.error('Gemini Transcribe Error:', error);
    const message = error instanceof Error ? error.message : 'Audio transcription failed';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maya AI Ultimate server running on http://localhost:${PORT}`);
  });
}

startServer();
