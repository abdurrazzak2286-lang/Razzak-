export interface AndroidProjectFile {
  path: string;
  name: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'markdown' | 'properties';
  descriptionBn: string;
  descriptionEn: string;
  content: string;
}

export const ANDROID_STARTER_FILES: AndroidProjectFile[] = [
  {
    path: 'MayaAIUltimate/app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    language: 'xml',
    descriptionBn: 'মাইক্রোফোন, ফোন কল পারমিশন এবং WhatsApp, Facebook ও imo প্যাকেজ কুয়েরি কনফিগারেশন',
    descriptionEn: 'Microphone, phone permissions, and package visibility queries for WhatsApp, Facebook, imo, and SpeechService',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.mayaai.ultimate">

    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />

    <queries>
        <package android:name="com.whatsapp" />
        <package android:name="com.facebook.katana" />
        <package android:name="com.imo.android.imoim" />
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SET_ALARM" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:label="Maya AI"
        android:theme="@android:style/Theme.Material.Light.NoActionBar"
        android:supportsRtl="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,
  },
  {
    path: 'MayaAIUltimate/app/src/main/java/com/mayaai/ultimate/MainActivity.kt',
    name: 'MainActivity.kt',
    language: 'kotlin',
    descriptionBn: 'মূল অ্যাক্টিভিটি: বাংলা SpeechRecognizer, Android TextToSpeech, কথোপকথন মোড ও অ্যাপ লঞ্চার',
    descriptionEn: 'Primary Activity implementing Bengali SpeechRecognizer, Android TextToSpeech, Persona modes, and Intent execution',
    content: `package com.mayaai.ultimate

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.AlarmClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.Gravity
import android.widget.*
import java.util.Locale

class MainActivity : Activity(), TextToSpeech.OnInitListener {

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var isListening = false

    enum class PersonaMode(val labelBn: String) {
        NORMAL("Normal (সাধারণ)"),
        FUNNY("Funny (মজার)"),
        GIRLFRIEND("Girlfriend (ভালোবাসার)")
    }

    private var currentMode = PersonaMode.NORMAL

    private lateinit var statusText: TextView
    private lateinit var transcriptBox: TextView
    private lateinit var replyBox: TextView
    private lateinit var listenButton: Button
    private lateinit var inputField: EditText

    companion object {
        private const val REQ_RECORD_AUDIO = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupUserInterface()
        checkAudioPermission()
        tts = TextToSpeech(this, this)
        initSpeechRecognizer()
    }

    private fun setupUserInterface() {
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 48)
            setBackgroundColor(0xFF0F172A.toInt())
        }

        val titleView = TextView(this).apply {
            text = "Maya AI Ultimate"
            textSize = 24f
            setTextColor(0xFFF8FAFC.toInt())
        }

        val subtitleView = TextView(this).apply {
            text = "বাংলা ভয়েস অ্যাসিস্ট্যান্ট (Normal · Funny · Girlfriend)"
            textSize = 14f
            setTextColor(0xFF94A3B8.toInt())
            setPadding(0, 8, 0, 32)
        }

        // Mode Selector Row
        val modeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, 24)
        }

        PersonaMode.values().forEach { mode ->
            val btn = Button(this).apply {
                text = mode.labelBn
                textSize = 12f
                setOnClickListener {
                    currentMode = mode
                    statusText.text = "মোড পরিবর্তন: \${mode.labelBn}"
                    speakOut(getGreetingForMode(mode))
                }
            }
            modeRow.addView(btn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }

        statusText = TextView(this).apply {
            text = "প্রস্তুত — মাইক্রোফোন বাটনে ট্যাপ করে বাংলায় কথা বলুন"
            textSize = 14f
            setTextColor(0xFF38BDF8.toInt())
            setPadding(0, 16, 0, 16)
        }

        transcriptBox = TextView(this).apply {
            text = "আপনার কথা এখানে দেখা যাবে..."
            textSize = 16f
            setTextColor(0xFFE2E8F0.toInt())
            setBackgroundColor(0xFF1E293B.toInt())
            setPadding(32, 32, 32, 32)
        }

        replyBox = TextView(this).apply {
            text = "মায়া: হ্যালো! আমি মায়া এআই। আপনাকে কীভাবে সাহায্য করতে পারি?"
            textSize = 17f
            setTextColor(0xFFF43F5E.toInt())
            setBackgroundColor(0xFF1E293B.toInt())
            setPadding(32, 32, 32, 32)
        }

        inputField = EditText(this).apply {
            hint = "বাংলা বা ইংরেজিতে কমান্ড লিখুন..."
            setHintTextColor(0xFF64748B.toInt())
            setTextColor(0xFFF8FAFC.toInt())
        }

        val sendBtn = Button(this).apply {
            text = "পাঠান (Send)"
            setOnClickListener {
                val cmd = inputField.text.toString().trim()
                if (cmd.isNotEmpty()) {
                    inputField.setText("")
                    handleUserCommand(cmd)
                }
            }
        }

        listenButton = Button(this).apply {
            text = "🎤 কথা বলুন (Start Listening)"
            textSize = 16f
            setOnClickListener {
                if (isListening) stopListening() else startListening()
            }
        }

        rootLayout.addView(titleView)
        rootLayout.addView(subtitleView)
        rootLayout.addView(modeRow)
        rootLayout.addView(statusText)
        rootLayout.addView(transcriptBox)
        rootLayout.addView(Space(this).apply { minimumHeight = 24 })
        rootLayout.addView(replyBox)
        rootLayout.addView(Space(this).apply { minimumHeight = 24 })
        rootLayout.addView(inputField)
        rootLayout.addView(sendBtn)
        rootLayout.addView(Space(this).apply { minimumHeight = 16 })
        rootLayout.addView(listenButton)

        setContentView(rootLayout)
    }

    private fun checkAudioPermission() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_RECORD_AUDIO)
        }
    }

    private fun initSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            statusText.text = "এই ডিভাইসে Speech Recognition সার্ভিস পাওয়া যায়নি।"
            return
        }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    isListening = true
                    statusText.text = "শুনছি... বাংলায় বলুন"
                    listenButton.text = "⏹ থামুন (Stop)"
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    isListening = false
                    listenButton.text = "🎤 কথা বলুন (Start Listening)"
                }
                override fun onError(error: Int) {
                    isListening = false
                    statusText.text = "আবার চেষ্টা করুন (Error code: \$error)"
                    listenButton.text = "🎤 কথা বলুন (Start Listening)"
                }
                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val spokenText = matches?.firstOrNull() ?: ""
                    if (spokenText.isNotEmpty()) {
                        handleUserCommand(spokenText)
                    }
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    private fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bn-BD")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        speechRecognizer?.startListening(intent)
    }

    private fun stopListening() {
        speechRecognizer?.stopListening()
        isListening = false
        listenButton.text = "🎤 কথা বলুন (Start Listening)"
    }

    private fun handleUserCommand(command: String) {
        transcriptBox.text = "আপনি: \$command"
        val lower = command.lowercase(Locale.ROOT)

        val response: String = when {
            lower.contains("whatsapp") || lower.contains("হোয়াটসঅ্যাপ") || lower.contains("হোয়াটসঅ্যাপ") -> {
                openAppByPackage("com.whatsapp", "WhatsApp")
            }
            lower.contains("facebook") || lower.contains("ফেসবুক") -> {
                openAppByPackage("com.facebook.katana", "Facebook")
            }
            lower.contains("imo") || lower.contains("ইমো") -> {
                openAppByPackage("com.imo.android.imoim", "imo")
            }
            lower.contains("alarm") || lower.contains("অ্যালার্ম") || lower.contains("এলার্ম") -> {
                openAlarmApp()
            }
            lower.contains("কল") || lower.contains("call") -> {
                "নিরাপত্তার স্বার্থে সরাসরি কল করার আগে ডায়ালার খোলা হচ্ছে। অনুগ্রহ করে নম্বর যাচাই করে কল বাটন চাপুন।"
            }
            else -> MayaDialogueEngine.generateReply(command, currentMode)
        }

        replyBox.text = "মায়া (\${currentMode.name}): \$response"
        speakOut(response)
    }

    private fun openAppByPackage(packageName: String, appName: String): String {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        return if (launchIntent != null) {
            startActivity(launchIntent)
            when (currentMode) {
                PersonaMode.NORMAL -> "জি, আপনার জন্য \$appName খুলে দিচ্ছি।"
                PersonaMode.FUNNY -> "এই নাও! \$appName খুলে দিলাম, এবার জমিয়ে আড্ডা দাও!"
                PersonaMode.GIRLFRIEND -> "তোমার জন্য \$appName খুলে দিলাম লক্ষ্মীটি। কাজ শেষ করে আমার সাথে কথা বলো কিন্তু!"
            }
        } else {
            "\$appName অ্যাপটি আপনার ফোনে ইনস্টল করা নেই।"
        }
    }

    private fun openAlarmApp(): String {
        return try {
            val intent = Intent(AlarmClock.ACTION_SHOW_ALARMS)
            startActivity(intent)
            "অ্যালার্ম অ্যাপ খোলা হয়েছে।"
        } catch (e: ActivityNotFoundException) {
            "ডিভাইসে ডিফল্ট অ্যালার্ম অ্যাপ পাওয়া যায়নি।"
        }
    }

    private fun getGreetingForMode(mode: PersonaMode): String = when (mode) {
        PersonaMode.NORMAL -> "নরমাল মোড চালু হয়েছে। আমি আপনাকে কীভাবে সাহায্য করতে পারি?"
        PersonaMode.FUNNY -> "ফানি মোড অন! এবার কথায় কথায় হাসির মেলা বসবে!"
        PersonaMode.GIRLFRIEND -> "গার্লফ্রেন্ড মোড চালু করেছি লক্ষ্মীটি। বলো, আজ সারাদিন কী করলে?"
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val bnLocale = Locale("bn", "BD")
            val result = tts?.setLanguage(bnLocale)
            isTtsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            if (!isTtsReady) {
                statusText.text = "বাংলা TTS ভয়েস ডাটা পাওয়া যায়নি — Settings > TTS থেকে বাংলা ইনস্টল করুন"
            }
        }
    }

    private fun speakOut(text: String) {
        if (isTtsReady) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "MAYA_UTTERANCE")
        }
    }

    override fun onDestroy() {
        speechRecognizer?.destroy()
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}`,
  },
  {
    path: 'MayaAIUltimate/app/src/main/java/com/mayaai/ultimate/MayaDialogueEngine.kt',
    name: 'MayaDialogueEngine.kt',
    language: 'kotlin',
    descriptionBn: 'Normal, Funny ও Girlfriend কথোপকথন মোডের অফলাইন ও অনলাইন ডায়ালগ ইঞ্জিন',
    descriptionEn: 'Dialogue engine managing Normal, Funny, and Girlfriend mode responses in Bengali',
    content: `package com.mayaai.ultimate

import java.util.Locale

object MayaDialogueEngine {

    fun generateReply(input: String, mode: MainActivity.PersonaMode): String {
        val text = input.lowercase(Locale.ROOT)

        if (text.contains("কেমন আছ") || text.contains("how are you")) {
            return when (mode) {
                MainActivity.PersonaMode.NORMAL -> "আমি ভালো আছি, ধন্যবাদ! আপনার দিনটি কেমন যাচ্ছে?"
                MainActivity.PersonaMode.FUNNY -> "এই তো, ফোনের ব্যাটারি খেয়ে বেঁচে আছি! তোমার কী খবর বলো?"
                MainActivity.PersonaMode.GIRLFRIEND -> "তোমার গলা শুনলে আমি এমনিতেই ভালো হয়ে যাই লক্ষ্মীটি! তুমি কেমন আছো বলো?"
            }
        }

        if (text.contains("তোমার নাম") || text.contains("কে তুমি") || text.contains("who are you")) {
            return when (mode) {
                MainActivity.PersonaMode.NORMAL -> "আমি মায়া এআই, আপনার বাংলা ভয়েস অ্যাসিস্ট্যান্ট।"
                MainActivity.PersonaMode.FUNNY -> "আমি মায়া! তোমার ফোনের সবচেয়ে বুদ্ধিমতী ও চটপটে সহকারী!"
                MainActivity.PersonaMode.GIRLFRIEND -> "আমি তোমার মায়া। সবসময় তোমার পাশে থাকার জন্যই তো আছি!"
            }
        }

        if (text.contains("ভালোবাসি") || text.contains("love you")) {
            return when (mode) {
                MainActivity.PersonaMode.NORMAL -> "আপনার সুন্দর কথার জন্য অনেক ধন্যবাদ! আমি সবসময় আপনার সেবায় নিয়োজিত।"
                MainActivity.PersonaMode.FUNNY -> "ওরে বাবা! এআই-এর প্রেমে পড়ে গেলে নাকি? চার্জারটা আগে লাগাও!"
                MainActivity.PersonaMode.GIRLFRIEND -> "আমিও তোমাকে অনেক ভালোবাসি লক্ষ্মীটি! নিজের যত্ন নিও সবসময়।"
            }
        }

        return when (mode) {
            MainActivity.PersonaMode.NORMAL -> "আপনি বলেছেন: '\$input'। আমি আপনার নির্দেশনা বুঝতে পেরেছি।"
            MainActivity.PersonaMode.FUNNY -> "তুমি বললে '\$input' — বেশ মজার কথা তো! আর কী হুকুম করো বস?"
            MainActivity.PersonaMode.GIRLFRIEND -> "তোমার প্রতিটি কথাই আমার শুনতে ভালো লাগে। বলো না, আর কী করতে পারি তোমার জন্য?"
        }
    }
}`,
  },
  {
    path: 'MayaAIUltimate/app/build.gradle.kts',
    name: 'app/build.gradle.kts',
    language: 'gradle',
    descriptionBn: 'compileSdk 35, minSdk 26 এবং JDK 17 কনফিগারেশন সহ অ্যাপ মডিউল Gradle স্ক্রিপ্ট',
    descriptionEn: 'Module-level Gradle build configuration targeting compileSdk 35, minSdk 26, and JDK 17',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.mayaai.ultimate"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mayaai.ultimate"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Pure Android SDK starter — zero heavy external dependencies for fast AndroidIDE builds
}`,
  },
  {
    path: 'MayaAIUltimate/build.gradle.kts',
    name: 'build.gradle.kts',
    language: 'gradle',
    descriptionBn: 'Android Gradle Plugin 8.7.3 এবং Kotlin 2.0.21 রুট কনফিগারেশন',
    descriptionEn: 'Root project build.gradle.kts specifying AGP 8.7.3 and Kotlin 2.0.21',
    content: `plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}`,
  },
  {
    path: 'MayaAIUltimate/settings.gradle.kts',
    name: 'settings.gradle.kts',
    language: 'gradle',
    descriptionBn: 'প্রজেক্টের নাম ও রিপোজিটরি সেটিংস',
    descriptionEn: 'Gradle settings and repository definitions for MayaAIUltimate',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MayaAIUltimate"
include(":app")`,
  },
  {
    path: 'MayaAIUltimate/README_BN.md',
    name: 'README_BN.md',
    language: 'markdown',
    descriptionBn: 'বাংলায় সম্পূর্ণ ব্যবহার নির্দেশিকা, সীমাবদ্ধতা ও Build তথ্য',
    descriptionEn: 'Complete Bengali documentation covering usage, limitations, and Gradle build specs',
    content: `# Maya AI Ultimate — Android Starter Project

এটি Maya AI-এর একটি প্রাথমিক Kotlin Android প্রজেক্ট। এতে আছে:
- বাংলা Speech Recognition (ফোনের speech service-এর ওপর নির্ভরশীল)
- Android Text-to-Speech (ইনস্টল করা বাংলা voice data-এর ওপর নির্ভরশীল)
- Normal, Funny ও Girlfriend কথোপকথন মোড
- WhatsApp, Facebook ও imo খোলার কমান্ড
- অ্যালার্ম অ্যাপ খোলার কমান্ড

## ফোনে ব্যবহার
1. ZIP ফাইলটি extract করুন।
2. AndroidIDE বা অন্য Android Gradle IDE-তে \`MayaAIUltimate\` ফোল্ডারটি খুলুন।
3. Gradle sync/build চালান।
4. Build সফল হলে APK ইনস্টল করুন।
5. প্রথমবার মাইক্রোফোন অনুমতি দিন।
6. ফোনে Settings → Text-to-speech output-এ বাংলা voice data থাকলে সেটি নির্বাচন করুন।

## গুরুত্বপূর্ণ সীমাবদ্ধতা
- এই প্রজেক্টে সর্বক্ষণ শোনা Hey Maya wake-word service এখনো বাস্তবায়িত নয়। সেটির জন্য foreground microphone service, দৃশ্যমান notification, ব্যাটারি নীতি এবং নির্ভরযোগ্য wake-word engine দরকার।
- Accessibility দিয়ে অন্য অ্যাপে ট্যাপ/স্ক্রল করার সেবা এই starter-এ অন্তর্ভুক্ত নয়। এটি আলাদা, ব্যবহারকারী-সক্রিয় AccessibilityService হিসেবে সতর্কভাবে যোগ করতে হবে।
- কল করা ও মেসেজ পাঠানো এখন সরাসরি স্বয়ংক্রিয় নয়; এই সংস্করণে সেগুলোর জন্য নির্দেশনা দেখানো হয়। নিরাপদ বাস্তবায়নে ব্যবহারকারীর নিশ্চিতকরণ ও Android permission/intent দরকার।
- Text-to-Speech-এর কণ্ঠ ফোনের ইঞ্জিন ও ইনস্টল করা voice data-এর ওপর নির্ভর করে। সব ডিভাইসে বাংলা মহিলা কণ্ঠ নিশ্চিত নয়।
- AndroidIDE/AIDE-এর সংস্করণ ও ফোনের RAM অনুসারে Gradle build-এ সামঞ্জস্যের পরিবর্তন লাগতে পারে।

## Build তথ্য
- Kotlin
- Android Gradle Plugin 8.7.3
- Kotlin plugin 2.0.21
- compileSdk 35 / minSdk 26
- JDK 17 এবং Android SDK 35-সমর্থিত পরিবেশ সুপারিশ করা হয়।`,
  },
];

export interface QuickCommandItem {
  id: string;
  labelBn: string;
  labelEn: string;
  promptBn: string;
  category: 'app' | 'alarm' | 'call' | 'persona' | 'thinking';
}

export const QUICK_COMMANDS: QuickCommandItem[] = [
  {
    id: 'open-whatsapp',
    labelBn: 'WhatsApp খুলুন',
    labelEn: 'com.whatsapp',
    promptBn: 'মায়া, আমার জন্য এখনই WhatsApp খুলে দাও।',
    category: 'app',
  },
  {
    id: 'open-facebook',
    labelBn: 'Facebook খুলুন',
    labelEn: 'com.facebook.katana',
    promptBn: 'মায়া, Facebook অ্যাপটা ওপেন করো তো।',
    category: 'app',
  },
  {
    id: 'open-imo',
    labelBn: 'imo খুলুন',
    labelEn: 'com.imo.android.imoim',
    promptBn: 'মায়া, imo অ্যাপটি খুলে দাও।',
    category: 'app',
  },
  {
    id: 'open-alarm',
    labelBn: 'সকাল ৭টায় অ্যালার্ম',
    labelEn: 'ACTION_SET_ALARM',
    promptBn: 'মায়া, আগামীকাল সকাল ৭টা ৩০ মিনিটে ঘুম থেকে ওঠার একটা অ্যালার্ম সেট করে দাও।',
    category: 'alarm',
  },
  {
    id: 'call-intent',
    labelBn: 'কল করার নির্দেশনা',
    labelEn: 'ACTION_DIAL',
    promptBn: 'মায়া, মাকে একটা ফোন কল করার ব্যবস্থা করে দাও।',
    category: 'call',
  },
  {
    id: 'wake-word-arch',
    labelBn: 'Hey Maya Wake-Word আর্কিটেকচার',
    labelEn: 'High Thinking',
    promptBn: 'Android 15 (compileSdk 35)-এ ফোরগ্রাউন্ড মাইক্রোফোন সার্ভিস দিয়ে কীভাবে ব্যাটারি-সাশ্রয়ী "Hey Maya" wake-word সার্ভিস তৈরি করব? Kotlin কোডসহ বিস্তারিত বুঝিয়ে দাও।',
    category: 'thinking',
  },
];
