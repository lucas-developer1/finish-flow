# 🎯 Finish Flow

**Smart Multi-Step Form System for Webflow**

Finish Flow ist ein leichtgewichtiges, wiederverwendbares JavaScript-System für mehrstufige Formulare in Webflow. Es löst die typischen Probleme von Multi-Step-Forms: FOUC (Flash of Unstyled Content), fehlende Progress-Speicherung und komplizierte Conditional Logic.

---

## ✨ Features

- ✅ **Kein FOUC** - Alle Steps sind von Anfang an versteckt
- 💾 **Auto-Save** - Fortschritt wird automatisch in LocalStorage gespeichert
- 🔄 **Progress Restore** - Bei Reload wird der Fortschritt wiederhergestellt
- ⚡ **Auto-Advance** - Radio Buttons und Selects können automatisch weiterschalten
- 🎯 **Conditional Logic** - Zeige/Verstecke Steps basierend auf Antworten
- ✔️ **Validierung** - Pflichtfelder mit Custom Error Messages
- 📊 **Progress Indicators** - Progress Bars, Step Numbers, etc.
- 📱 **Mobile Optimized** - Touch-freundlich und responsive
- ♿ **Accessibility** - Keyboard Navigation und Screen Reader Support
- 🎨 **Full Design Control** - Style alles in Webflow wie du willst

---

## 🚀 Quick Start

### 1. CDN Links in Webflow einbinden

Füge folgendes in dein Webflow-Projekt ein (Project Settings → Custom Code → Head Code):

```html
<!-- Finish Flow CSS -->
<link rel="stylesheet" href="https://finish-flow-one.vercel.app/finish-flow.css">

<!-- Finish Flow JavaScript -->
<script src="https://finish-flow-one.vercel.app/finish-flow.js"></script>
