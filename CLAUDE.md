# CLAUDE.md

Contexto del proyecto para sesiones de Claude Code. Léelo antes de tocar código.

## Qué es esto

Presentación web sobre el **Event Loop de JavaScript**, para dar en vivo.

Nació de otro proyecto (`../animaciones-para-presentaciones`) donde Juan hizo 10
animaciones GSAP del Event Loop. Al montar la charla se topó con que un vídeo o
un GIF no se puede controlar al ritmo de la explicación, así que la presentación
se hace directamente en web: así controla las animaciones mientras habla.

**Este repo es ahora el hogar oficial** de `shared/` y de las animaciones. El
repo `animaciones-para-presentaciones` queda como archivo histórico: no editar
las animaciones allí.

## Cómo abrirla

Doble clic en `index.html`. No hay build, ni `npm install`, ni servidor.

Para servirla por HTTP (útil si hace falta): `python -m http.server 8777`.

Controles: clic izquierdo/rueda abajo/`→`/`Espacio`/`PageDown` avanza,
clic derecho/rueda arriba/`←`/`PageUp` retrocede,
`Inicio`/`Fin` primera y última, `F` pantalla completa, `H` ayuda.
`PageUp`/`PageDown` están incluidas porque son las teclas que envía un mando de
presentación.

## Estructura

```
index.html          Todas las slides, una <section class="slide"> cada una
css/deck.css        Estilos del deck (paleta, tipografía, layout de slide)
js/deck.js          Motor: navegación, escalado, carga diferida de animaciones
animaciones/        Las animaciones GSAP, un HTML completo cada una
shared/
  styles.css        Estilos de las animaciones (paleta y componentes)
  controls.js       Escalado del escenario, controles y puente con el deck
vendor/             GSAP y las fuentes (DM Sans, Inter, JetBrains Mono), en local
img/                Imágenes que usan las slides (el avatar de la portada)
images/             Los diseños de Juan (capturas de cada slide). Local y
                    temporal: está en .gitignore y NO se sube
```

## Cómo funciona

### Escalado

Deck y animaciones usan el mismo truco: un lienzo de tamaño fijo en píxeles
(1920x1080 el deck y las animaciones anchas, 1080x1080 las cuadradas) escalado
con `transform: scale()` para caber en la ventana. Se diseña una vez sobre
medidas conocidas y se ve idéntico en el portátil y en el proyector.

En el deck lo hace `escalarLienzo()` (`js/deck.js`), que escribe la variable CSS
`--escala`. En las animaciones lo hace `ajustarEscenario()` (`shared/controls.js`).

### Las animaciones van en iframe (a propósito)

Cada animación es un HTML completo con **IDs globales repetidos entre archivos**
(`#slot`, `#progreso`) y variables globales en el script (`const bloques`).
Metidas todas en una sola página chocarían y habría que renombrarlo todo. El
iframe las aísla, no hay que tocar ninguna, y cada una sigue funcionando sola si
se abre directamente.

En `index.html` se embeben con **`data-src`, no `src`**, para que `deck.js` las
cargue solo cuando la slide se acerca (la actual y sus dos vecinas).

### El puente deck ↔ animación

`shared/controls.js` detecta con `dentroDelDeck = window.parent !== window` si
está embebido, y cambia tres cosas:

| | Animación sola | Dentro del deck |
|---|---|---|
| Arranque | autoplay en bucle | en pausa; el deck la reinicia al entrar en la slide |
| Flechas | recorren labels de la timeline | cambian de slide |
| `configurarNavegacion()` | dibuja Anterior/Siguiente | no dibuja nada |
| Mouse | nada especial | clic = slide siguiente, clic derecho = anterior, la rueda se reenvía al deck; al moverlo aparece la barra de control |

Mensajes por `postMessage`:

- deck → animación: `{origen:'deck', accion:'activar'|'desactivar'}`.
  `activar` hace `tl.restart()` para que el público vea la animación **empezar**,
  no a mitad del bucle.
- animación → deck: `{origen:'animacion', accion:'siguiente'|'anterior'}`.
  Hace falta porque si se hace clic en la animación el foco cae en el iframe y el
  deck dejaría de oír el teclado.

Efecto secundario aceptado: dentro del deck las flechas ya no recorren la
timeline paso a paso. Para eso está la **barra de control**. Tiene reiniciar,
paso anterior/siguiente (salta entre los labels de la timeline y pausa ahí),
play/pausa y el contador de pasos. Existe porque en la charla quizá solo haya
un mouse.

- **Vive en el deck, no en la animación** (`index.html`, sección 5b de
  `deck.js`, sección 9 de `deck.css`). Así se coloca **debajo** del iframe de
  la slide actual. Dentro del iframe siempre tapaba algo; por eso la
  animación ancha mide 1600x900: deja sitio a la barra.
- Protocolo: deck → animación `reiniciar`/`paso-anterior`/`paso-siguiente`/
  `alternar`; animación → deck `estado` {pausada, paso, total} y `mouse`.
  Todo está en `conectarControlConDeck()` de `controls.js`.
- El estado se avisa también justo después de cada orden, no solo desde
  `gsap.ticker`: con la timeline en pausa GSAP deja de emitir frames y el
  contador se quedaba congelado.
- Los clics en la barra se frenan con `stopPropagation()` para que no
  cambien de slide. La animación 07 tiene un solo label: ahí solo sirven
  play/pausa y reiniciar.

La rueda cambia de slide con un bloqueo en `alGirarRueda()` (`deck.js`): tras
cambiar, ignora la rueda hasta que lleve 250 ms quieta. Así un gesto (con
inercia de touchpad incluida) cuenta como una sola slide. La animación 07 tiene un solo label, así que ahí solo sirve play/pausa.

### Agregar o reordenar slides

Todo en `index.html`. Copia un bloque `<section class="slide">` y muévelo:
`deck.js` recoge las slides con `querySelectorAll`, y el contador y la barra de
progreso se ajustan solos. Clases de slide (sección 4 de `css/deck.css`):

| Clase | Para qué |
|---|---|
| `slide--portada` | Ponente arriba y título enorme |
| `slide--centrada` | Frases al público (`.frase`) y separadores (`.seccion`), rejilla de `.actores` |
| `slide--texto` | Texto corrido: párrafos (`.parrafos`) o bullets (`.puntos`) con negritas |
| `slide--partida` | Texto a la izquierda (500px) y animación de 796px a la derecha |
| `slide--partida-ancha` | Igual, con columna de texto de 930px (listas `.lista`: Call Stack, Event Loop, Web APIs) |
| `slide--partida-media` | Columna de 540px pegada a la animación, texto `.encabezado-lateral` alineado a la derecha |
| `slide--partida-cola` | Columna de 757px para el bloque `.cola` (Macrotask/Microtask: alias, título, puntos y ejemplos) |
| `slide--comparacion` | Dos columnas de texto, cada una con su bloque `.codigo-slide` |
| `slide--lienzo` | Animación 16:9 a sangre |
| `slide--oscura` | Modificador: fondo tinta y letra amarilla. `deck.js` invierte también la barra y el contador |

**Pasos (bullets que aparecen de uno en uno):** cualquier elemento con
`class="aparece"` empieza escondido. Avanzar lo revela y solo cuando se ven
todos pasa de slide; retroceder los esconde en orden inverso. Al volver a una
slide desde la siguiente, llega con todos visibles. Está en la sección 3b de
`deck.js`: `siguiente()`/`anterior()` son la única puerta de entrada, así que
funciona con teclas, clic, rueda y mando. Hoy lo usan los bullets de la
slide 4 (`.puntos`, antes eran párrafos), Call Stack, Event Loop, Web APIs y
las dos colas; en las colas, el bloque de
ejemplos aparece entero en un solo paso.

Las medidas son píxeles fijos sobre el lienzo de 1920x1080, **sacadas de los
diseños de `images/`**. No uses porcentajes ni `height: 100%` para las
animaciones: así se desbordaba la slide antes.

Para la animación: `class="animacion"` si es cuadrada, `class="animacion
animacion--ancha"` si es 16:9. Son 16:9 los ejemplos
(`10-ejemplo-settimeout.html`, `11-ejemplo-promise.html`,
`12-ejemplo-promesas-encadenadas.html`) y `call-stack.html`.

### Los ejemplos: un solo molde de UI

`10-ejemplo-settimeout.html` es **el molde** de todos los ejemplos. Tiene los
mismos paneles, en las mismas posiciones y con los mismos títulos, aunque un
ejemplo deje uno vacío. Un ejemplo nuevo se hace copiando ese archivo y
cambiando **solo** el título, el código, los frames/items/líneas de consola y
el guion de la timeline. **No se toca el `<style>` ni la estructura.**

Límites del molde (medidos): la consola cabe **3 líneas** (con 4 se corta),
el Call Stack 4 frames, Web APIs/Microtask/Macrotask **1 item cada uno** a la
vez, y el código 16 líneas. Por eso el Ejemplo 2 es más complejo en lógica
(las dos colas compitiendo; salida C, B, A) y no en cantidad. El Ejemplo 3
muestra una microtask que encola otra durante el vaciado (salida B, C, A).
Para que dos items de una misma cola no choquen, comparten `--i: 0` y nunca
están visibles a la vez.

El contador de ciclo se cambia con `tl.set($("ciclo"), { textContent })`,
**no con `tl.call()`**: GSAP no ejecuta los `call()` al saltar entre pasos
(botones de la barra) y el texto se quedaba desfasado. Las microtasks corren
en el mismo ciclo que la tarea que las encoló; el ciclo sube al tomar la
siguiente macrotask.

## Convenciones

- **Vanilla HTML/CSS/JS, sin build ni dependencias.** Decidido a conciencia: las
  animaciones son GSAP imperativo sobre el DOM; React solo añadiría envoltorio
  (`useRef` + `useEffect` con limpieza de timelines) para el mismo resultado. Y
  sin build, presentar es doble clic: no hay un `dist/` que pueda fallar.
- **Nada de CDNs.** GSAP y las fuentes están en `vendor/` y los HTML apuntan ahí.
  La presentación debe funcionar sin internet: depender del wifi del sitio
  donde se da la charla es un riesgo real. Si agregas una librería, bájala.
- **Código y comentarios en español**, incluidos nombres de funciones y
  variables (`escalarLienzo`, `dentroDelDeck`, `avisarAnimacion`). Los archivos
  llevan una cabecera con el índice de secciones numeradas, y los comentarios
  explican **por qué**, no qué. Sigue ese estilo.
- **Tipografía**: DM Sans (Juan dijo "DS Sans", es DM Sans). Se usa con
  `font-optical-sizing: none` y dos espaciados: `--tracking-titulo: -0.085em`
  en los títulos grandes (el "-8%" de Juan) y `--tracking: -0.035em` en el
  texto corrido. Se midió sobre los píxeles de los diseños, con el alto de la
  tinta para el tamaño y el ancho para el espaciado. Con -8% en todo, el texto
  corrido quedaba pegado. El eje óptico automático hace lo mismo con los títulos.
- **Paleta**: amarillo `#FFEA00` sobre tinta `#1E1E1E`. Es la identidad de la
  presentación. Las animaciones van invertidas (fondo oscuro, acento amarillo)
  para contrastar dentro de la slide amarilla.
- **Commits**: en español, una sola línea, simples. **Nunca** líneas de
  coautor ni de atribución generada. Instrucción explícita de Juan.

## Estado actual

Las 29 slides están montadas. Van de la portada a "Gracias wdt :)". El
tramo final es de Claude, sin diseño de Juan, con el estilo de la slide 4:

- 21 "Ejemplos", y 22 a 24 los Ejemplos 1, 2 y 3 (el 2 y el 3, sobre el molde)
- 25 "¿Te ha pasado?": bugs cotidianos (síntoma + causa) y "Spoiler: todo eso
  es el Event Loop"
- 26 "En resumen"
- 27 "¿Aburrido? Tal vez.": responde a la broma de la slide 2
- 28 "¿Por qué importa?": el mensaje de la IA y el software engineer

### Pendiente

1. Si llegan más ejemplos, van entre el último ejemplo y "¿Te ha pasado?",
   siguiendo el molde.
2. **Revisión de Juan en su pantalla**, sobre todo el ritmo al cambiar de slide
   y que las animaciones arranquen bien.

## Detalles que ahorran tiempo

- **Capturas sin navegador interactivo**: Chrome headless funciona.
  `chrome.exe --headless=new --hide-scrollbars --window-size=1920,1080
  --virtual-time-budget=8000 --screenshot=salida.png "file:///.../index.html#5"`.
  El `#n` abre la slide n. A veces la captura sale a mitad del fundido y se ve
  más apagada: no es un error.

- **Ojo con `sed` en los `<head>`**: la mayoría de las animaciones tienen los
  `<link>` en una línea, pero `10-ejemplo-settimeout.html` está formateado por
  Prettier con los atributos repartidos en varias líneas. Un reemplazo por línea
  lo rompe. Ya pasó una vez.
- Git avisa de `LF will be replaced by CRLF` al hacer commit. Es Windows, es
  esperado, no hay nada que arreglar.
- `configurarControles(tl, infinita = true)`: el segundo parámetro pone la
  timeline en bucle. Todas las animaciones lo usan por defecto.
