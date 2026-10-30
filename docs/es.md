# YOURLS

[YOURLS](https://yourls.org/) (Your Own URL Shortener) es un acortador de
enlaces autoalojado, libre (MIT), escrito en PHP. Esta integración lo lleva a
Gladys: su YOURLS se convierte en un dispositivo con su número de enlaces, sus
clics, los clics de su enlace más visitado y los clics de los enlaces que usted
decida seguir. Las escenas pueden reaccionar cuando un enlace seguido supera un
número redondo de clics, acortar una dirección y transmitir el enlace corto, o
leer los clics de cualquier enlace; un widget del panel lista los enlaces más
visitados.

Probado con un YOURLS 1.10.6 autoalojado real (imagen Docker oficial, MariaDB);
sus comentarios son bienvenidos en
[las issues](https://github.com/guim31/gladys-yourls/issues).

## Lo que necesita

- Gladys Assistant 5.1.0 o posterior.
- Un YOURLS (versión 1.5 o posterior) accesible desde la máquina de Gladys, en
  su red o en Internet.
- Su **token de firma**, o un usuario y una contraseña de su administración.

En cada actualización, la integración envía una petición (los totales y los
diez enlaces más visitados), más una por enlace seguido: 11 peticiones como
máximo. YOURLS no fija ninguna cuota a su API.

## Primeros pasos

### 1. Encontrar el token de firma

En la administración de YOURLS, abra la página **Herramientas** (Tools): la
parte «Secure passwordless API call» muestra su token de firma (una serie de
letras y cifras). Permite a la integración usar la API sin su contraseña. Sin
él, la integración puede usar un usuario y una contraseña de la
administración.

### 2. Configurar la integración

En Gladys, abra **Integraciones → YOURLS → Configuración**:

- **Dirección de YOURLS**: la dirección de su YOURLS, la que usan sus enlaces
  cortos, por ejemplo `https://sho.rt` o `http://192.168.1.10:8080/s`. Se
  entiende una dirección copiada de la administración (`/admin/`) o de la API
  (`/yourls-api.php`); sin `http://`, se usa `https://`.
- **Token de firma**: el token del paso 1; o déjelo vacío y rellene **Usuario
  (sin token)** y **Contraseña (sin token)**.
- **Enlaces a seguir**: las palabras clave de los enlaces cortos que seguir,
  separadas por comas, por ejemplo `news, menu` (10 como máximo; también vale
  una dirección corta completa). Cada una se convierte en una función y puede
  activar «Hito de clics».
- **Intervalo de actualización**: 1, 5 (por defecto) o 15 minutos.
- **Idioma de los nombres**: el idioma de los nombres de las funciones, fijados
  al añadir el dispositivo, y de los errores de las acciones de escena.

**Probar la conexión** lee YOURLS y responde con su versión, el número de
enlaces y de clics, y las palabras clave no encontradas.

### 3. Añadir el dispositivo

Abra la pestaña **Descubrir** de la integración y añada el dispositivo YOURLS.
Tras cambiar los enlaces a seguir, la pestaña propone actualizar el
dispositivo.

## El dispositivo

| Función                       | Lo que muestra                                                       |
| ----------------------------- | -------------------------------------------------------------------- |
| Accesible                     | 1 cuando YOURLS responde, 0 tras dos lecturas fallidas seguidas      |
| Enlaces cortos                | los enlaces cortos de la base de datos                               |
| Clics                         | los clics de todos los enlaces                                       |
| Clics del enlace más visitado | los clics del enlace más visitado                                    |
| Enlace más visitado           | la palabra clave del enlace más visitado, `-` sin ningún enlace      |
| `Clics: news`                 | los clics de un enlace seguido (aquí `news`), una por enlace seguido |

Las cifras son las de YOURLS: todos los clics, robots incluidos (YOURLS no los
distingue).

## Panel

El widget **Enlaces YOURLS** muestra los clics y los enlaces en total, y luego
los enlaces más visitados con sus clics. El botón **Actualizar** vuelve a leer
YOURLS. Sus ajustes:

- **Enlaces mostrados** (5 o 10);
- **Mostrar los totales**;
- **Mostrar el botón Actualizar**.

## Escenas

### Disparadores

- **Hito de clics**: un enlace seguido supera un número redondo de clics: 10,
  25, 50, 100, 250, 500, 1000, 2500… hasta 1 000 000. Filtros: la palabra clave
  (vacío: cualquier enlace seguido) y el hito (vacío: todos). Variables:
  palabra clave, dirección corta, dirección de destino, título, clics, hito.
  Cada hito se activa una vez, aunque se superen varios entre dos lecturas o
  mientras Gladys estaba parado.

### Acciones

- **Acortar una dirección**: crea un enlace corto en YOURLS. Campos: la dirección
  (debe empezar por `http://` o `https://`; las variables de escena son
  bienvenidas), una palabra clave y un título (opcionales). Resultados: palabra
  clave, dirección corta, dirección de destino, título, clics y «enlace nuevo»
  (no cuando YOURLS ya conocía la dirección: devuelve su enlace existente, como
  hace YOURLS por defecto).
- **Leer un enlace corto**: lee un enlace por su palabra clave (o su dirección
  corta), seguido o no. Resultados: palabra clave, dirección corta, dirección
  de destino, título, clics.

### Ideas de escenas

- Un mensaje cuando el enlace de su anuncio alcanza 100 clics: disparador **Hito
  de clics** con la palabra clave y el hito 100.
- Cada mañana, **Acortar una dirección** con la página del menú del día, y luego
  enviar la dirección corta por Telegram.
- Cada domingo por la noche, **Leer un enlace corto** de su boletín y enviar sus
  clics.

## Solución de problemas

- **«YOURLS no responde»**: compruebe la dirección y que Gladys puede acceder a
  YOURLS (red, cortafuegos, puerto).
- **«token de firma o contraseña rechazados»**: vuelva a copiar el token desde la
  página Herramientas (cambia con la clave de cookie de YOURLS), o compruebe el
  usuario y la contraseña.
- **«no hay ninguna API de YOURLS en esta dirección»**: la dirección apunta a
  otro sitio: use la dirección de los enlaces cortos, con el subdirectorio de
  YOURLS si lo hay.
- **«la dirección redirige»**: introduzca directamente la dirección `https://`.
- **«certificado rechazado»**: el certificado HTTPS es autofirmado o ha caducado:
  use la dirección `http://` en su red local, o un certificado reconocido.
- Una palabra clave seguida no encontrada no tiene valor; **Probar la conexión**
  la nombra.
- Los registros nunca muestran el token, la contraseña ni los visitantes.

## Límites

- Los enlaces a seguir se escriben en la configuración (10 como máximo), no se
  eligen de una lista: YOURLS puede contener miles de enlaces.
- YOURLS cuenta todos los clics, robots y vistas previas de enlaces incluidos.
- Con un YOURLS que guarda un solo enlace por dirección (el ajuste por defecto),
  acortar una dirección conocida devuelve su enlace existente, incluso con otra
  palabra clave.
- El dispositivo muestra la instancia; el historial de un enlace empieza cuando
  usted lo sigue.
