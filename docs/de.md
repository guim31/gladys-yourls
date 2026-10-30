# YOURLS

[YOURLS](https://yourls.org/) (Your Own URL Shortener) ist ein selbst gehosteter
Linkkürzer, quelloffen (MIT), in PHP geschrieben. Diese Integration bringt ihn
in Gladys: Dein YOURLS wird ein Gerät mit der Zahl seiner Links, seinen Klicks,
den Klicks seines meistgeklickten Links und den Klicks der Links, die du
verfolgen willst. Szenen können reagieren, wenn ein verfolgter Link eine runde
Klickzahl überschreitet, eine Adresse kürzen und den Kurzlink weitergeben oder
die Klicks eines beliebigen Links lesen; ein Dashboard-Widget listet die
meistgeklickten Links.

Getestet mit einem echten, selbst gehosteten YOURLS 1.10.6 (offizielles
Docker-Image, MariaDB); Rückmeldungen sind willkommen in
[den Issues](https://github.com/guim31/gladys-yourls/issues).

## Was du brauchst

- Gladys Assistant 5.1.0 oder neuer.
- Ein YOURLS (Version 1.5 oder neuer), das vom Gladys-Rechner aus erreichbar
  ist, in deinem Netz oder im Internet.
- Sein **Signatur-Token** oder einen Benutzernamen und ein Passwort der
  Verwaltung.

Bei jeder Aktualisierung sendet die Integration eine Anfrage (die Summen und
die zehn meistgeklickten Links), dazu eine pro verfolgtem Link: höchstens 11
Anfragen. YOURLS setzt seiner API kein Kontingent.

## Erste Schritte

### 1. Das Signatur-Token finden

Öffne in der YOURLS-Verwaltung die Seite **Werkzeuge** (Tools): Der Teil „Secure
passwordless API call“ zeigt dein Signatur-Token (eine Folge aus Buchstaben und
Ziffern). Damit nutzt die Integration die API ohne dein Passwort. Ohne Token
kann die Integration einen Benutzernamen und ein Passwort der Verwaltung
nutzen.

### 2. Die Integration konfigurieren

Öffne in Gladys **Integrationen → YOURLS → Konfiguration**:

- **YOURLS-Adresse**: die Adresse deines YOURLS, die deine Kurzlinks nutzen,
  zum Beispiel `https://sho.rt` oder `http://192.168.1.10:8080/s`. Eine aus der
  Verwaltung (`/admin/`) oder der API (`/yourls-api.php`) kopierte Adresse wird
  verstanden; ohne `http://` wird `https://` genutzt.
- **Signatur-Token**: das Token aus Schritt 1; oder lass es leer und fülle
  **Benutzername (ohne Token)** und **Passwort (ohne Token)** aus.
- **Zu verfolgende Links**: die Schlüsselwörter der zu verfolgenden Kurzlinks,
  durch Kommas getrennt, zum Beispiel `news, menu` (höchstens 10; eine
  vollständige Kurzadresse geht auch). Jedes wird eine Funktion und kann
  „Klick-Meilenstein“ auslösen.
- **Aktualisierungsintervall**: 1, 5 (Standard) oder 15 Minuten.
- **Sprache der Namen**: die Sprache der Funktionsnamen, beim Anlegen des
  Geräts festgelegt, und der Fehler der Szenen-Aktionen.

**Verbindung testen** liest YOURLS und antwortet mit seiner Version, der Zahl
der Links und Klicks und den nicht gefundenen Schlüsselwörtern.

### 3. Das Gerät anlegen

Öffne den Tab **Entdecken** der Integration und lege das YOURLS-Gerät an. Nach
einer Änderung der zu verfolgenden Links bietet der Tab an, das Gerät zu
aktualisieren.

## Das Gerät

| Funktion             | Was sie zeigt                                                            |
| -------------------- | ------------------------------------------------------------------------ |
| Erreichbar           | 1, wenn YOURLS antwortet, 0 nach zwei fehlgeschlagenen Abfragen in Folge |
| Kurzlinks            | die Kurzlinks der Datenbank                                              |
| Klicks               | die Klicks aller Links                                                   |
| Klicks des Top-Links | die Klicks des meistgeklickten Links                                     |
| Meistgeklickter Link | das Schlüsselwort des meistgeklickten Links, `-` ohne Link               |
| `Klicks: news`       | die Klicks eines verfolgten Links (hier `news`), eine pro Link           |

Die Zahlen sind die von YOURLS: alle Klicks, Bots eingeschlossen (YOURLS
unterscheidet sie nicht).

## Dashboard

Das Widget **YOURLS-Links** zeigt die Klicks und die Links insgesamt, dann die
meistgeklickten Links mit ihren Klicks. Die Schaltfläche **Aktualisieren**
liest YOURLS neu. Seine Einstellungen:

- **Angezeigte Links** (5 oder 10);
- **Summen anzeigen**;
- **Schaltfläche Aktualisieren anzeigen**.

## Szenen

### Auslöser

- **Klick-Meilenstein**: Ein verfolgter Link überschreitet eine runde Klickzahl:
  10, 25, 50, 100, 250, 500, 1.000, 2.500 … bis 1.000.000. Filter: das
  Schlüsselwort (leer: jeder verfolgte Link) und der Meilenstein (leer: alle).
  Variablen: Schlüsselwort, Kurzadresse, Zieladresse, Titel, Klicks,
  Meilenstein. Jeder Meilenstein löst einmal aus, auch wenn mehrere zwischen
  zwei Abfragen oder während eines Stopps von Gladys überschritten werden.

### Aktionen

- **Adresse kürzen**: erstellt einen Kurzlink in YOURLS. Felder: die Adresse (sie
  muss mit `http://` oder `https://` beginnen; Szenenvariablen sind
  willkommen), ein Schlüsselwort und ein Titel (optional). Ergebnisse:
  Schlüsselwort, Kurzadresse, Zieladresse, Titel, Klicks und „Neuer Link“
  (nein, wenn YOURLS die Adresse schon kannte: Es liefert den vorhandenen Link,
  wie YOURLS es standardmäßig tut).
- **Kurzlink lesen**: liest einen Link anhand seines Schlüsselworts (oder seiner
  Kurzadresse), verfolgt oder nicht. Ergebnisse: Schlüsselwort, Kurzadresse,
  Zieladresse, Titel, Klicks.

### Szenen-Ideen

- Eine Nachricht, wenn der Link deiner Anzeige 100 Klicks erreicht: Auslöser
  **Klick-Meilenstein** mit dem Schlüsselwort und dem Meilenstein 100.
- Jeden Morgen **Adresse kürzen** für die Seite des Tagesmenüs, dann die
  Kurzadresse per Telegram senden.
- Jeden Sonntagabend **Kurzlink lesen** für deinen Newsletter und seine Klicks
  senden.

## Fehlerbehebung

- **„YOURLS antwortet nicht“**: Prüfe die Adresse und ob Gladys YOURLS erreicht
  (Netz, Firewall, Port).
- **„Signatur-Token oder Passwort abgelehnt“**: Kopiere das Token erneut von der
  Seite Werkzeuge (es ändert sich mit dem Cookie-Schlüssel von YOURLS) oder
  prüfe Benutzername und Passwort.
- **„keine YOURLS-API unter dieser Adresse“**: Die Adresse zeigt woandershin:
  Nutze die Adresse der Kurzlinks, mit dem Unterverzeichnis von YOURLS, falls
  vorhanden.
- **„die Adresse leitet um“**: Gib direkt die `https://`-Adresse ein.
- **„Zertifikat abgelehnt“**: Das HTTPS-Zertifikat ist selbst signiert oder
  abgelaufen: Nutze die `http://`-Adresse in deinem lokalen Netz oder ein
  vertrauenswürdiges Zertifikat.
- Ein nicht gefundenes verfolgtes Schlüsselwort hat keinen Wert; **Verbindung
  testen** nennt es.
- Die Protokolle zeigen nie das Token, das Passwort oder die Besucher.

## Grenzen

- Die zu verfolgenden Links werden in der Konfiguration eingetippt (höchstens
  10), nicht aus einer Liste gewählt: YOURLS kann Tausende Links enthalten.
- YOURLS zählt alle Klicks, Bots und Linkvorschauen eingeschlossen.
- Bei einem YOURLS, das einen Link pro Adresse behält (Standard), liefert das
  Kürzen einer bekannten Adresse ihren vorhandenen Link, auch mit einem anderen
  Schlüsselwort.
- Das Gerät zeigt die Instanz; der Verlauf eines Links beginnt, wenn du ihn
  verfolgst.
