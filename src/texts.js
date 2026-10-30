// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, scene action
// errors. Four languages, the four of the Gladys interface; German says "du",
// Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './yourls/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// What is missing in the configuration (src/config.js missingCredentials).
export const CONNECTION_TEXT = {
  noUrl: {
    en: 'Fill in the address of your YOURLS and its signature token.',
    fr: "Indiquez l'adresse de votre YOURLS et son jeton de signature.",
    de: 'Gib die Adresse deines YOURLS und sein Signatur-Token an.',
    es: 'Indique la dirección de su YOURLS y su token de firma.',
  },
  invalidUrl: {
    en: 'Address not understood, e.g. https://sho.rt',
    fr: 'Adresse incomprise, ex. https://sho.rt',
    de: 'Adresse nicht verstanden, z. B. https://sho.rt',
    es: 'Dirección no válida, p. ej. https://sho.rt',
  },
  noAuth: {
    en: 'Paste the signature token (YOURLS admin, Tools page), or a username and password.',
    fr: "Collez le jeton de signature (admin de YOURLS, page Outils), ou un nom d'utilisateur et un mot de passe.",
    de: 'Füge das Signatur-Token ein (YOURLS-Verwaltung, Seite Werkzeuge) oder einen Benutzernamen und ein Passwort.',
    es: 'Pegue el token de firma (administración de YOURLS, página Herramientas), o un usuario y una contraseña.',
  },
};

// One short explanation per error kind (src/yourls/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'YOURLS does not answer',
    fr: 'YOURLS ne répond pas',
    de: 'YOURLS antwortet nicht',
    es: 'YOURLS no responde',
  },
  [ERROR_KINDS.TLS]: {
    en: 'certificate refused: use an http:// address or a trusted certificate',
    fr: 'certificat refusé : utilisez une adresse http:// ou un certificat reconnu',
    de: 'Zertifikat abgelehnt: Nutze eine http://-Adresse oder ein vertrauenswürdiges Zertifikat',
    es: 'certificado rechazado: use una dirección http:// o un certificado reconocido',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'signature token or password refused',
    fr: 'jeton de signature ou mot de passe refusé',
    de: 'Signatur-Token oder Passwort abgelehnt',
    es: 'token de firma o contraseña rechazados',
  },
  [ERROR_KINDS.NOT_YOURLS]: {
    en: 'no YOURLS API at this address',
    fr: 'aucune API YOURLS à cette adresse',
    de: 'keine YOURLS-API unter dieser Adresse',
    es: 'no hay ninguna API de YOURLS en esta dirección',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'the address redirects: enter the https:// address',
    fr: "l'adresse redirige : saisissez l'adresse en https://",
    de: 'die Adresse leitet um: Gib die https://-Adresse ein',
    es: 'la dirección redirige: introduzca la dirección https://',
  },
  [ERROR_KINDS.NOT_FOUND]: {
    en: 'no short link with this keyword',
    fr: 'aucun lien court avec ce mot-clé',
    de: 'kein Kurzlink mit diesem Schlüsselwort',
    es: 'ningún enlace corto con esta palabra clave',
  },
  [ERROR_KINDS.KEYWORD_TAKEN]: {
    en: 'this keyword is already used or reserved',
    fr: 'ce mot-clé est déjà pris ou réservé',
    de: 'dieses Schlüsselwort ist schon vergeben oder reserviert',
    es: 'esta palabra clave ya está en uso o reservada',
  },
  [ERROR_KINDS.BAD_URL]: {
    en: 'YOURLS refused this address',
    fr: 'YOURLS a refusé cette adresse',
    de: 'YOURLS hat diese Adresse abgelehnt',
    es: 'YOURLS ha rechazado esta dirección',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'unexpected answer, see the logs',
    fr: 'réponse inattendue, voir les logs',
    de: 'unerwartete Antwort, sieh in den Protokollen nach',
    es: 'respuesta inesperada, consulte los registros',
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: 'Connected',
    links: (n) => `${n} link(s)`,
    clicks: (n) => `${n} click(s)`,
    missing: (list) => `keyword(s) not found: ${list}`,
  },
  fr: {
    ok: 'Connecté',
    links: (n) => `${n} lien(s)`,
    clicks: (n) => `${n} clic(s)`,
    missing: (list) => `mot(s)-clé(s) introuvable(s) : ${list}`,
  },
  de: {
    ok: 'Verbunden',
    links: (n) => `${n} Link(s)`,
    clicks: (n) => `${n} Klick(s)`,
    missing: (list) => `Schlüsselwort/-wörter nicht gefunden: ${list}`,
  },
  es: {
    ok: 'Conectado',
    links: (n) => `${n} enlace(s)`,
    clicks: (n) => `${n} clic(s)`,
    missing: (list) => `palabra(s) clave no encontrada(s): ${list}`,
  },
};

// Errors of the scene actions, on what the scene gave them.
export const ACTION_TEXT = {
  badUrl: {
    en: 'The address to shorten must start with http:// or https://.',
    fr: "L'adresse à raccourcir doit commencer par http:// ou https://.",
    de: 'Die zu kürzende Adresse muss mit http:// oder https:// beginnen.',
    es: 'La dirección que se va a acortar debe empezar por http:// o https://.',
  },
  badKeyword: {
    en: 'A keyword holds only letters, digits, - and _.',
    fr: 'Un mot-clé ne contient que des lettres, des chiffres, - et _.',
    de: 'Ein Schlüsselwort enthält nur Buchstaben, Ziffern, - und _.',
    es: 'Una palabra clave solo contiene letras, cifras, - y _.',
  },
};

export const LANGUAGE_FALLBACK = 'en';

/** "Name: text", with the space French puts before a colon. */
export const labelled = (name, text, language) =>
  `${name}${language === 'fr' ? ' : ' : ': '}${text}`;
export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];
