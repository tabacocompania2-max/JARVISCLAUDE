# 🤖 JARVIS — English Learning Coach

Asistente de inglés personal con IA, diseñado para instalarse como **app nativa en Android/iOS**.  
Hablas → Jarvis escucha → transcribe → responde con IA → te corrige y enseña.

---

## 📁 Estructura del Proyecto

```
jarvis-app/
├── server/        → Backend Node.js + Express (API)
└── mobile/        → App móvil React Native (Expo)
```

---

## 🚀 PASO 1: Configurar el Servidor

### Requisitos
- Node.js v18+
- Cuenta en [Groq](https://console.groq.com) (gratis, sin tarjeta de crédito)

### Instalación

```bash
cd server
npm install
cp .env.example .env
```

### Variables de entorno (`.env`)

```
PORT=3001
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
```

> 🔑 Obtén tu API Key gratis en **https://console.groq.com** → API Keys → Create

### Iniciar servidor

```bash
npm run dev
```

El servidor corre en `http://0.0.0.0:3001`  
Verifica en: `http://localhost:3001/api/health`

---

## 📱 PASO 2: Configurar la App Móvil

### Requisitos
- Node.js v18+
- Expo CLI: `npm install -g expo-cli`
- App **Expo Go** en tu celular (Android o iOS)

### Instalación

```bash
cd mobile
npm install
```

### ⚠️ IMPORTANTE: Configurar la IP del servidor

Abre `mobile/src/services/api.ts` y cambia la URL:

```typescript
// Cambia esta línea con la IP de TU computadora
export const API_BASE_URL = 'http://TU_IP_AQUI:3001';

// Ejemplo: 'http://192.168.1.15:3001'
```

> 💡 Para encontrar tu IP:
> - **Windows**: `ipconfig` en CMD → busca "Dirección IPv4"  
> - **Mac/Linux**: `ifconfig` o `ip addr`

### Iniciar la app

```bash
npm start
```

Se abrirá un QR en la terminal. **Escanéalo con Expo Go** en tu celular.  
¡La app cargará directamente en tu teléfono!

---

## 📲 PASO 3: Instalar como App Nativa (APK)

Para tener la app instalada permanentemente sin Expo Go:

```bash
# Instala EAS CLI
npm install -g eas-cli

# Inicia sesión en Expo
eas login

# Construye el APK
cd mobile
eas build --platform android --profile preview
```

Expo te dará un link para descargar el APK e instalarlo en tu Android.

---

## 🧠 Cómo Funciona

```
Tú hablas  →  [Expo Audio]  →  Grabación .m4a
                                      ↓
                          [Groq Whisper API] → Transcripción
                                      ↓
                          [Groq LLaMA 3.3 70B] → Respuesta IA
                                      ↓
                          [Expo Speech] → Jarvis habla
```

### Comandos que Jarvis entiende:
| Lo que dices | Lo que hace |
|---|---|
| "Palabras del día" / "Quiero vocabulario" | Lista de 10 palabras con pronunciación |
| "Dame un podcast en inglés" | Recomienda un podcast + tag YouTube |
| "Pon música" | Recomienda canción en inglés |
| "Corrige mi inglés" | Modo corrección activo (siempre activo) |
| "My progress" / "Mi progreso" | Resumen de la sesión |
| Cualquier frase en inglés | Jarvis responde y corrige errores |

### Formato de corrección:
> Jarvis siempre corrige así:
> ❌ "I go to store yesterday"  
> ✅ "I **went** to the store yesterday"  
> 📝 Regla: Con "yesterday" se usa pasado simple.

---

## 🔧 Personalización

### Cambiar el nombre del asistente
Edita `server/src/prompts/system.ts`

### Cambiar el modelo de IA
En `server/.env`:
```
GROQ_MODEL=llama-3.3-70b-versatile   # Default (más capaz)
GROQ_MODEL=llama-3.1-8b-instant      # Más rápido, menos capaz
GROQ_MODEL=mixtral-8x7b-32768        # Contexto muy largo
```

### Modelos disponibles en Groq (gratis)
- `llama-3.3-70b-versatile` ⭐ Recomendado
- `llama-3.1-8b-instant` ⚡ Ultra rápido
- `gemma2-9b-it`

---

## 🌐 Deploy en Producción (Opcional)

Para tener el servidor online (no depender de tu PC):

### Railway (gratis hasta cierto límite)
1. Ve a [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Sube el repo y configura las variables de entorno
4. Railway te da una URL como `https://jarvis-xxx.railway.app`
5. Cambia `API_BASE_URL` en `mobile/src/services/api.ts` con esa URL

---

## 🐛 Problemas Comunes

**"No se puede conectar al servidor"**
- Verifica que el servidor esté corriendo con `npm run dev`
- Confirma que la IP en `api.ts` sea correcta
- Asegúrate de que tu celular y PC estén en la misma red WiFi
- Deshabilita el firewall de Windows temporalmente

**"Error de micrófono"**
- La app pedirá permiso al iniciar, acepta
- En Android: Configuración → Apps → Jarvis → Permisos → Micrófono

**"La transcripción no funciona"**
- Verifica que `GROQ_API_KEY` esté en el `.env`
- Habla claro y no muy rápido la primera vez

---

## 📦 Stack Técnico

| Capa | Tecnología |
|---|---|
| IA / Chat | Groq API → LLaMA 3.3 70B |
| Transcripción | Groq Whisper Large v3 |
| Backend | Node.js + Express + TypeScript |
| App Móvil | React Native + Expo |
| Audio | expo-av |
| Voz (TTS) | expo-speech |
| Storage local | AsyncStorage |
