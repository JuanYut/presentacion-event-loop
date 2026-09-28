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

Controles: `→`/`Espacio`/`PageDown` avanza, `←`/`PageUp` retrocede,
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
vendor/             GSAP y las fuentes, en local
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

Mensajes por `postMessage`:

- deck → animación: `{origen:'deck', accion:'activar'|'desactivar'}`.
  `activar` hace `tl.restart()` para que el público vea la animación **empezar**,
  no a mitad del bucle.
- animación → deck: `{origen:'animacion', accion:'siguiente'|'anterior'}`.
  Hace falta porque si se hace clic en la animación el foco cae en el iframe y el
  deck dejaría de oír el teclado.

Efecto secundario aceptado: dentro del deck las flechas ya no recorren la
timeline paso a paso. Para eso: clic en la animación y `R`.

### Agregar o reordenar slides

Todo en `index.html`. Copia un bloque `<section class="slide">` y muévelo:
`deck.js` recoge las slides con `querySelectorAll`, y el contador y la barra de
progreso se ajustan solos. Clases de slide disponibles: `slide--portada`
(centrada), `slide--lienzo` (animación a sangre), `slide--partida` (texto y
animación en dos columnas).

Para la animación: `class="animacion"` si es cuadrada, `class="animacion
animacion--ancha"` si es 16:9. De las 11 animaciones, solo
`10-ejemplo-settimeout.html` y `call-stack.html` son 16:9.

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
- **Paleta**: amarillo `#FFEA00` sobre tinta `#1E1E1E`. Es la identidad de la
  presentación. Las animaciones van invertidas (fondo oscuro, acento amarillo)
  para contrastar dentro de la slide amarilla.
- **Commits**: en español, una sola línea, simples. **Nunca** líneas de
  coautor ni de atribución generada. Instrucción explícita de Juan.

## Estado actual

Primer commit hecho (`4548b48`). Funcionando: el motor del deck, la portada y
las 10 animaciones embebidas, cada una en su slide con un título.

### Pendiente

1. **Las imágenes de las slides.** Juan las va a pasar para armar la
   presentación de verdad. Los títulos actuales los deduje del índice del repo
   viejo, y **no hay ninguna slide de texto todavía**: solo portada +
   animaciones. Con las imágenes hay que ajustar títulos, textos, orden y montar
   las slides sin animación.
2. **El orden real de las slides** (si entre la portada y la animación 01 va una
   agenda, una presentación personal, una pregunta al público...).
3. **Verificación visual.** Nadie ha visto todavía el deck renderizado: la
   sesión que lo montó no tenía herramientas de navegador. Se comprobó que las
   25 rutas responden 200 y que no quedan referencias externas, pero el aspecto
   (tamaño de la animación dentro de la slide, tipografía, ritmo al cambiar de
   slide) está sin revisar. **Pregunta a Juan qué se ve mal antes de dar por
   bueno el diseño.**

## Detalles que ahorran tiempo

- **Ojo con `sed` en los `<head>`**: la mayoría de las animaciones tienen los
  `<link>` en una línea, pero `10-ejemplo-settimeout.html` está formateado por
  Prettier con los atributos repartidos en varias líneas. Un reemplazo por línea
  lo rompe. Ya pasó una vez.
- Git avisa de `LF will be replaced by CRLF` al hacer commit. Es Windows, es
  esperado, no hay nada que arreglar.
- `configurarControles(tl, infinita = true)`: el segundo parámetro pone la
  timeline en bucle. Las 10 animaciones lo usan por defecto.
