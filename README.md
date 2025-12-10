# 🎯 Finish Flow

**Smart Multi-Step Form System for Webflow**

Finish Flow ist ein leichtgewichtiges, wiederverwendbares JavaScript-System für mehrstufige Formulare in Webflow. Es löst die typischen Probleme von Multi-Step-Forms: FOUC (Flash of Unstyled Content), fehlende Progress-Speicherung und komplizierte Conditional Logic.

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

## 🚀 Quick Start

### 1. CDN Links in Webflow einbinden

Füge folgendes in dein Webflow-Projekt ein (Project Settings → Custom Code → Head Code):

```html
<!-- Finish Flow CSS -->
<link rel="stylesheet" href="https://finish-flow-one.vercel.app/finish-flow.css">

<!-- Finish Flow JavaScript -->
<script src="https://finish-flow-one.vercel.app/finish-flow.js"></script>
```

### 2. Formular in Webflow aufbauen

Erstelle ein normales Webflow-Formular und füge folgende Attributes hinzu:

**Haupt-Form:**
- Attribute: `data-finish-flow`
- Attribute: `data-auto-init` (optional, für automatische Initialisierung)
- Vergib eine ID: z.B. `id="myForm"`

**Steps (Div Blocks):**
- Attribute: `data-form-step="1"`
- Attribute: `data-form-step="2"`
- Attribute: `data-form-step="3"`
- etc.

**Navigation Buttons:**
- "Weiter" Button: `data-next-button`
- "Zurück" Button: `data-prev-button`

**Fertig!** Das war's schon. Dein Multi-Step-Form funktioniert jetzt.

## 📖 Detaillierte Anleitung

### Basis-Setup

So sieht die HTML-Struktur aus (du baust das in Webflow):

```html
<form id="myForm" data-finish-flow data-auto-init>
  
  <!-- Step 1 -->
  <div data-form-step="1">
    <h2>Schritt 1</h2>
    <input type="text" name="name" placeholder="Dein Name" required>
    <button data-next-button>Weiter</button>
  </div>
  
  <!-- Step 2 -->
  <div data-form-step="2">
    <h2>Schritt 2</h2>
    <input type="email" name="email" placeholder="Deine E-Mail" required>
    <button data-prev-button>Zurück</button>
    <button data-next-button>Weiter</button>
  </div>
  
  <!-- Step 3 -->
  <div data-form-step="3">
    <h2>Schritt 3</h2>
    <textarea name="message" placeholder="Deine Nachricht"></textarea>
    <button data-prev-button>Zurück</button>
    <button type="submit">Absenden</button>
  </div>
  
</form>
```

### Auto-Advance (Radio Buttons)

Für Fragen mit Radio Buttons, die automatisch zum nächsten Schritt springen:

**Option 1 - Ganzer Container:**

```html
<div data-form-step="1" data-auto-advance="true">
  <h3>Was interessiert dich?</h3>
  <label><input type="radio" name="interest" value="webdesign"> Webdesign</label>
  <label><input type="radio" name="interest" value="development"> Development</label>
  <label><input type="radio" name="interest" value="seo"> SEO</label>
</div>
```

**Option 2 - Einzelne Radio-Gruppe:**

```html
<div data-form-step="1">
  <h3>Was interessiert dich?</h3>
  <label><input type="radio" name="interest" value="webdesign" data-auto-advance> Webdesign</label>
  <label><input type="radio" name="interest" value="development" data-auto-advance> Development</label>
  <label><input type="radio" name="interest" value="seo" data-auto-advance> SEO</label>
</div>
```

### Conditional Logic (Wenn-Dann)

Zeige Steps nur unter bestimmten Bedingungen:

```html
<!-- Step wird nur gezeigt wenn interest=webdesign -->
<div data-form-step="2" data-show-if="interest=webdesign">
  <h3>Webdesign Details</h3>
  <input type="text" name="design_preference">
</div>

<!-- Step wird NUR gezeigt wenn interest NICHT webdesign ist -->
<div data-form-step="2" data-hide-if="interest=webdesign">
  <h3>Andere Details</h3>
  <input type="text" name="other_info">
</div>
```

**Mehrere Bedingungen (AND-Logik):**

```html
<!-- Wird nur gezeigt wenn interest=webdesign UND budget=high -->
<div data-show-if="interest=webdesign,budget=high">
  <h3>Premium Webdesign Optionen</h3>
</div>
```

### Error Messages

Zeige Custom Error Messages pro Step:

```html
<div data-form-step="1">
  <h2>Deine Daten</h2>
  
  <div data-error-message>
    Bitte fülle alle Pflichtfelder aus!
  </div>
  
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  
  <button data-next-button>Weiter</button>
</div>
```

### Progress Indicators

**Progress Bar:**

```html
<div class="progress-container">
  <div data-progress-bar></div>
</div>
```

**Step Indicator Text:**

```html
<div data-step-indicator></div>
<!-- Zeigt automatisch: "Schritt 1 von 3" -->
```

**Step Numbers/Dots:**

```html
<div class="step-numbers">
  <span data-step-number>1</span>
  <span data-step-number>2</span>
  <span data-step-number>3</span>
</div>
```

## ⚙️ Erweiterte Konfiguration

Wenn du mehr Kontrolle brauchst, kannst du das Formular manuell initialisieren (ohne `data-auto-init`):

```javascript
document.addEventListener('DOMContentLoaded', function() {
  const myForm = new FinishFlow('#myForm', {
    autoSaveDelay: 500,           // Wie schnell soll gespeichert werden (ms)
    progressExpiryHours: 24,      // Nach wie vielen Stunden verfällt der Progress
    confirmRestore: true,         // Nachfrage vor Restore (true/false)
    animations: true,             // Animationen aktivieren (true/false)
    debug: false                  // Debug-Modus (zeigt Console Logs)
  });
});
```

## 🎨 Custom Styling

Du kannst alle Elemente in Webflow stylen. Hier sind die wichtigsten CSS-Klassen:

- `.finish-flow-error` - Wird auf fehlerhafte Inputs gesetzt
- `.active` - Aktiver Step Number
- `.completed` - Abgeschlossene Step Numbers
- `[data-error-message]` - Error Message Container
- `[data-progress-bar]` - Progress Bar

## 📱 Alle verfügbaren Attributes

### Form Attributes

| Attribute | Beschreibung |
|-----------|--------------|
| `data-finish-flow` | Markiert das Haupt-Formular |
| `data-auto-init` | Automatische Initialisierung |

### Step Attributes

| Attribute | Wert | Beschreibung |
|-----------|------|--------------|
| `data-form-step` | `1`, `2`, `3`... | Definiert einen Formular-Schritt |
| `data-auto-advance` | `true` | Auto-weiter nach Auswahl |
| `data-show-if` | `fieldname=value` | Zeige nur wenn Bedingung erfüllt |
| `data-hide-if` | `fieldname=value` | Verstecke wenn Bedingung erfüllt |

### Button Attributes

| Attribute | Beschreibung |
|-----------|--------------|
| `data-next-button` | "Weiter" Button |
| `data-prev-button` | "Zurück" Button |

### UI Attributes

| Attribute | Beschreibung |
|-----------|--------------|
| `data-progress-bar` | Progress Bar Element |
| `data-step-indicator` | Zeigt "Schritt X von Y" |
| `data-step-number` | Step Number/Dot Element |
| `data-error-message` | Error Message Container |

## 🔧 JavaScript API

Falls du das Formular programmatisch steuern willst:

```javascript
const form = new FinishFlow('#myForm');

// Zu bestimmtem Step springen
form.goToStep(2);

// Formular zurücksetzen
form.reset();

// Aktuelle Daten auslesen
const data = form.getData();
console.log(data);

// Daten setzen
form.setData({ name: 'Max', email: 'max@example.com' });

// Progress löschen
form.clearProgress();
```

## 🐛 Troubleshooting

### Form wird nicht initialisiert

- ✅ Stelle sicher, dass das Formular eine ID hat
- ✅ Prüfe ob `data-finish-flow` gesetzt ist
- ✅ Öffne die Browser Console und schaue nach Fehlern

### Steps erscheinen alle gleichzeitig

- ✅ CSS ist nicht geladen - prüfe die CDN-URL
- ✅ Stelle sicher, dass `data-form-step` richtig gesetzt ist

### Auto-Advance funktioniert nicht

- ✅ Prüfe ob Radio Buttons ein `name` Attribute haben
- ✅ `data-auto-advance` muss richtig gesetzt sein

### Progress wird nicht gespeichert

- ✅ Formular braucht eine eindeutige ID
- ✅ LocalStorage muss im Browser aktiviert sein
- ✅ Private/Incognito Mode blockiert manchmal LocalStorage

## 📦 Installation

### Via CDN (Empfohlen)

```html
<link rel="stylesheet" href="https://finish-flow-one.vercel.app/finish-flow.css">
<script src="https://finish-flow-one.vercel.app/finish-flow.js"></script>
```

### Via Download

1. Lade `finish-flow.js` und `finish-flow.css` herunter
2. Hoste sie auf deinem eigenen Server
3. Binde sie in Webflow ein

## 📄 Lizenz

MIT License - Nutze es wie du willst!

## 🤝 Support

Bei Fragen oder Problemen:
- Öffne ein Issue auf GitHub
- Oder kontaktiere mich direkt

## 🎯 Roadmap

Geplante Features:

- [ ] Mehr Validierungs-Optionen
- [ ] Calculations (Preisberechnung)
- [ ] Analytics Integration
- [ ] Custom Events
- [ ] Multi-Language Support

---

**Version:** 1.0.0  
**Erstellt für:** Webflow  
**Browser Support:** Chrome, Firefox, Safari, Edge (moderne Versionen)

---

Made with ❤️ for the Webflow Community
