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
| `slide--portada` | Ponente arriba y título enorme, con movimiento leve y cíclico: el avatar flota y "Event Loop" tiene un brillo que lo cruza (CSS puro, se detiene con `prefers-reduced-motion`). Juan pidió animar lo que ya había, sin agregar elementos |
| `slide--centrada` | Frases al público (`.frase`) y separadores (`.seccion`), rejilla de `.actores` |
| `slide--texto` | Texto corrido: párrafos (`.parrafos`) o bullets (`.puntos`) con negritas |
| `slide--partida` | Texto a la izquierda (500px) y animación de 796px a la derecha |
| `slide--partida-ancha` | Igual, con columna de texto de 930px (listas `.lista`: Call Stack, Event Loop, Web APIs) |
| `slide--partida-media` | Columna de 540px pegada a la animación, texto `.encabezado-lateral` alineado a la derecha |
| `slide--partida-cola` | Columna de 757px para el bloque `.cola` (Macrotask/Microtask: alias, título, puntos y ejemplos) |
| `slide--comparacion` | Dos columnas de texto, cada una con su bloque `.codigo-slide` |
| `slide--lienzo` | Animación 16:9 a sangre |
| `slide--oscura` | Modificador: fondo tinta y letra amarilla. `deck.js` invierte también la barra y el contador |
| `slide--quiz` | "¿Qué se imprime?": código a la izquierda y 3 opciones numeradas (no con letras: A, B, C es lo que imprime el código). La correcta se marca con el siguiente clic (`.opcion__marca`, un paso `.aparece`) |
| `slide--vf` | "¿Verdadero o falso?": una afirmación grande y, con el siguiente clic, el veredicto en una pastilla negra y su explicación (`.vf__respuesta`, un paso `.aparece`). También sirve para preguntas abiertas al público (síncrono vs asíncrono: la pastilla dice "Pista") |
| `oculta` | Saca la slide de la charla sin borrarla: `deck.js` solo recoge `.slide:not(.oculta)`, así que el contador y la numeración por `#n` la ignoran |

**Pasos (bullets que aparecen de uno en uno):** cualquier elemento con
`class="aparece"` empieza escondido. Avanzar lo revela y solo cuando se ven
todos pasa de slide; retroceder los esconde en orden inverso. Al volver a una
slide desde la siguiente, llega con todos visibles. Está en la sección 3b de
`deck.js`: `siguiente()`/`anterior()` son la única puerta de entrada, así que
funciona con teclas, clic, rueda y mando. Hoy lo usan los bullets de la
historia del Event Loop (`.puntos`, antes eran párrafos), "¿Qué va en las colas?", Call Stack, Event Loop, Web APIs y
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

La charla está completa: 38 slides en el HTML, 36 visibles (2 ocultas).
Esta lista va **por títulos y en orden**, no por número: los números cambian
cada vez que se agrega o se quita una slide. Lo marcado con (C) lo hizo
Claude sin diseño de Juan; el resto sale de sus diseños.

1. Portada (avatar que flota y brillo en "Event Loop")
2. Sección "¿Qué es el Event Loop?"
3. La historia del Event Loop, en bullets por pasos. Juan pidió reescribirla
   porque con la versión anterior "hasta yo me confundo al leerla": ahora va
   un solo hilo → el problema → la solución → quién decide cuándo retomar
   (el Event Loop) → qué se gana
4. (C) "Vamos a explicar algunas cositas de JavaScript…"
5. Single-threaded, síncrono y asincronía con el Event Loop (con animaciones)
6. (C) Pregunta abierta: "¿Cuál es la diferencia entre síncrono y asíncrono?",
   con pista (una llamada vs un WhatsApp)
7. Síncrono vs Asíncrono: el `// Output: 1, 2` aparece con un clic, para
   preguntar antes qué se imprime
8. "¿Todo chido hasta aquí? :)", sección ACTORES y Call Stack
9. Event Loop, y Web APIs precedido de (C) "¿Verdadero o falso? setTimeout es
   parte de JavaScript" (falso). Luego las 4 categorías de Web APIs
10. Actores: colas. (C) "¿Qué va en las colas?": todo lo que llega a las colas
    es código asíncrono, pero lo que espera es el callback, no la llamada
11. Macrotask Queue, (C) "¿Verdadero o falso? Todo lo que está dentro de una
    Promise se ejecuta después" (falso), y Microtask Queue
12. (C) "¿Quién hace qué?": la rejilla de ACTORES con el papel de cada uno
    en una línea, como repaso antes de los ejemplos. Aparecen en el orden en
    que trabajan (stack → Web APIs → colas → event loop), cada uno en su sitio
13. Sección "Ejemplos". Por cada ejemplo, un (C) "¿Qué se imprime?" y la
    animación. Ejemplos 2 y 3 son (C) sobre el molde. **El Ejemplo 3 y su quiz
    están ocultos** (`oculta`): Juan lo quitó para acortar
14. (C) "Cada vez que tu app se congela, el Event Loop te está diciendo algo."
    Antes era una lista de bugs ("¿Te ha pasado?") que no le convenció
15. (C) "En resumen"
16. (C) "¿Aburrido? Tal vez.": respondía a la broma de apertura ("¿Event
    Loop?, ¿neta, wey?, qué aburrido"), que Juan quitó para ahorrar tiempo;
    ahora se sostiene sola
17. (C) Cierre emocional: "…alguien tiene que saber cómo funcionan los
    fierros. Sé esa persona." (negra) y "El Event Loop nunca se detiene. Que
    tu curiosidad tampoco." (amarilla)
18. "Gracias wdt :)"

**Ritmo de participación.** Juan pidió "más emoción". Las preguntas al
público ("¿Qué se imprime?", "¿Verdadero o falso?", la pregunta abierta) se
reparten para que participe cada 5 o 6 slides, sobre todo en el tramo largo
de conceptos. Se probó y se quitó una demo que congelaba la página 3 s: no
le convenció.

### Pendiente

1. Si llegan más ejemplos, van antes de "Cada vez que tu app se congela…",
   cada uno con su "¿Qué se imprime?" delante, siguiendo el molde.
2. **Revisión de Juan en su pantalla**, sobre todo el ritmo al cambiar de slide
   y que las animaciones arranquen bien.

## Detalles que ahorran tiempo

- **Capturas sin navegador interactivo**: Chrome headless funciona.
  `chrome.exe --headless=new --hide-scrollbars --window-size=1920,1080
  --virtual-time-budget=8000 --screenshot=salida.png "file:///.../index.html#5"`.
  El `#n` abre la slide n. A veces la captura sale a mitad del fundido y se ve
  más apagada: no es un error.
  Para ver una slide **con sus pasos revelados y sin fundido**, cárgala en un
  iframe desde una página auxiliar. Espera ~800 ms tras su `load` (antes de eso
  el arranque del deck vuelve a esconder los pasos), inyecta
  `.slide, .aparece { transition: none !important; }` y ponle `.visible` a
  los `.aparece` de `.slide.activa`.

- **Ojo con `sed` en los `<head>`**: la mayoría de las animaciones tienen los
  `<link>` en una línea, pero `10-ejemplo-settimeout.html` está formateado por
  Prettier con los atributos repartidos en varias líneas. Un reemplazo por línea
  lo rompe. Ya pasó una vez.
- Git avisa de `LF will be replaced by CRLF` al hacer commit. Es Windows, es
  esperado, no hay nada que arreglar.
- `configurarControles(tl, infinita = true)`: el segundo parámetro pone la
  timeline en bucle. Todas las animaciones lo usan por defecto.
