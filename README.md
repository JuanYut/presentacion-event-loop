# Presentación: El Event Loop de JavaScript

Presentación web de las animaciones del Event Loop. Nació de un proyecto de
animaciones sueltas: al montar la charla, un vídeo o un GIF no permitía
controlar la animación al ritmo de la explicación, así que la presentación
se hizo directamente en web.

## Cómo presentar

Abre `index.html` con doble clic. No hay build ni servidor ni dependencias que
instalar: es HTML, CSS y JavaScript, y GSAP y las fuentes están en `vendor/`,
así que **funciona sin conexión a internet**.

Pulsa `F` para pantalla completa y `H` para ver los controles.

| Tecla | Acción |
|---|---|
| `→` `↓` `Espacio` `Enter` `PageDown` | Slide siguiente |
| `←` `↑` `Backspace` `PageUp` | Slide anterior |
| `Inicio` / `Fin` | Primera / última slide |
| `F` | Pantalla completa |
| `H` | Mostrar u ocultar la ayuda |

`PageUp` y `PageDown` son las teclas que envían los mandos de presentación,
así que un clicker funciona sin configurar nada.

La slide actual queda en la URL (`index.html#7`), así que si el navegador se
recarga a mitad de la charla vuelves al mismo sitio.

## Estructura

```
index.html          Todas las slides, una <section class="slide"> cada una
css/deck.css        Estilos del deck (paleta, tipografía, layout de slide)
js/deck.js          Motor: navegación, escalado y carga de animaciones
animaciones/        Las animaciones GSAP, una por archivo HTML
shared/
  styles.css        Estilos de las animaciones (paleta y componentes)
  controls.js       Escalado del escenario, controles y puente con el deck
vendor/             GSAP y las fuentes, en local para presentar sin internet
```

### Agregar o reordenar una slide

Todo pasa en `index.html`. Copia un bloque `<section class="slide">` y muévelo
donde quieras: `deck.js` recoge las slides con `querySelectorAll`, y el
contador y la barra de progreso se ajustan solos.

Para embeber una animación se usa `data-src` en vez de `src`, de modo que el
iframe se cargue solo cuando la slide se acerca:

```html
<!-- animación cuadrada (1080x1080) -->
<iframe class="animacion" data-src="animaciones/01-single-thread.html"></iframe>

<!-- animación en 16:9 (1920x1080) -->
<iframe class="animacion animacion--ancha" data-src="animaciones/10-ejemplo-settimeout.html"></iframe>
```

### Por qué las animaciones van en iframe

Cada animación es un HTML completo con sus propios IDs (`#slot`, `#progreso`)
y variables globales, repetidos entre archivos. Metidas todas en una sola
página chocarían entre sí y habría que renombrarlo todo. El iframe las aísla,
no hay que tocar ninguna, y cada una sigue funcionando por separado si la abres
directamente.

## Cómo funciona el escalado

El deck y las animaciones usan el mismo truco: un lienzo de tamaño fijo en
píxeles (1920x1080, o 1080x1080 las cuadradas) que se escala con
`transform: scale()` para caber en la ventana. Se diseña una sola vez sobre
medidas conocidas y se ve igual en el portátil y en el proyector.

## Las animaciones dentro y fuera del deck

`shared/controls.js` detecta si está dentro de un iframe (`dentroDelDeck`) y
cambia tres cosas:

- **Arranque**: fuera del deck la animación empieza sola en bucle; dentro
  espera, y el deck la reinicia desde cero cuando su slide entra en pantalla,
  para que el público la vea empezar y no a mitad del bucle.
- **Flechas**: fuera del deck avanzan paso a paso por la timeline; dentro
  cambian de slide (si el foco cayó en el iframe, las reenvía al deck con
  `postMessage`).
- **Navegación propia**: los botones "Anterior / Siguiente" de las animaciones
  se ocultan dentro del deck, porque ahí navega el deck.

Dentro del deck, `Espacio` avanza de slide. Para pausar una animación concreta,
haz clic en ella y usa `R` para reiniciarla.
