/* ============================================================
   shared/controls.js
   Código común para todas las animaciones:

     1. Constantes de duración y easing (DUR, EASE)
     2. Ajuste del escenario 1920x1080 a la ventana
     3. Controles de teclado: configurarControles(tl)
        3b. Puente con el deck (postMessage)
        3c. Control con mouse dentro del deck (órdenes de la barra, clics)
        3d. Modo paso a paso (el presentador avanza la animación a clics)
     4. Utilidades de escena (apilar, desapilar, encolar, imprimir...)

   Requiere que GSAP ya esté cargado (window.gsap).
   No usa módulos ni fetch: funciona abriendo el HTML con doble clic.
   ============================================================ */

/* ---------- 0. Contexto ----------
   Las animaciones se usan de dos maneras:
     · sueltas, abriendo el HTML directamente (como hasta ahora)
     · dentro del deck, embebidas en un <iframe> por js/deck.js
   Todo lo que cambia entre ambos modos se decide con esta bandera. */
const dentroDelDeck = window.parent !== window;

// Referencia a la timeline de la escena, para que el deck pueda pausarla
// y reiniciarla al entrar y salir de la slide.
let timelinePrincipal = null;

// Modo paso a paso (sección 3d): lo enciende el deck al activar la slide.
let pasoAPaso = false;
let tweenPaso = null;   // el tramo que se está reproduciendo, si hay uno

/* ---------- 1. Constantes de animación ----------
   Todas las escenas usan estos valores para que el ritmo sea consistente.
   Ajusta aquí si quieres que todo vaya más rápido o más lento. */
const DUR = {
  rapida: 0.3,   // resaltar línea, pequeños cambios
  normal: 0.5,   // entrar/salir de un panel
  lenta: 0.9,    // movimientos largos entre paneles
  pausa: 0.7,    // respiro entre pasos para que el espectador lea
  margen: 1.0,   // silencio al inicio y al final (facilita recortar el video)
};

const EASE = {
  entrada: 'back.out(1.4)',   // algo aparece (frame, item, línea de consola)
  salida: 'power2.in',        // algo desaparece
  mover: 'power2.inOut',      // algo se desplaza (resaltado, item entre paneles)
  suave: 'power2.out',        // valor por defecto de las timelines
};

/* ---------- 2. Ajuste del escenario ----------
   El .stage tiene un tamaño fijo en píxeles (1920x1080, o 1080x1080 con
   .stage--cuadrado); aquí lo escalamos para que quepa en la ventana sin
   deformarse. Al grabar en pantalla completa con la misma resolución la
   escala será exactamente 1. */
function ajustarEscenario() {
  const stage = document.querySelector('.stage');
  if (!stage) return;
  const escala = Math.min(window.innerWidth / stage.offsetWidth,
                          window.innerHeight / stage.offsetHeight);
  stage.style.transform = `translate(-50%, -50%) scale(${escala})`;
}
window.addEventListener('resize', ajustarEscenario);
ajustarEscenario();

/* ---------- 3. Controles de teclado ----------
   configurarControles(tl, infinita) recibe la timeline principal de GSAP y agrega:

     Espacio  → play / pausa (si terminó, vuelve a empezar)
     R        → volver al inicio (queda en pausa, lista para grabar)
     →  /  ←  → saltar al siguiente / anterior label de la timeline
     H        → mostrar / ocultar la ayuda

   Si infinita === true, la animación se reproduce en bucle infinito.
   La timeline arranca en pausa: nada se mueve hasta pulsar Espacio. */
function configurarControles(tl, infinita = true) {
  const ayuda = document.querySelector('.ayuda');
  const pista = document.querySelector('.pista');

  timelinePrincipal = tl;
  if (infinita) tl.repeat(-1);

  if (dentroDelDeck) {
    // Dentro del deck arranca en pausa: deck.js la reinicia cuando su slide
    // entra en pantalla, para que el público siempre la vea desde el principio.
    tl.pause(0);
    if (pista) pista.classList.add('oculto');
    escucharAlDeck();
  } else if (infinita) {
    tl.play();
  } else {
    tl.pause(0);
  }

  // Devuelve los tiempos de todos los labels ordenados de menor a mayor
  const tiemposLabels = () => Object.values(tl.labels).sort((a, b) => a - b);

  // Salta al label siguiente (dir = +1) o anterior (dir = -1) y pausa ahí
  function saltarLabel(dir) {
    const actual = tl.time();
    const margen = 0.01; // tolerancia para no quedarse "pegado" en el label actual
    const tiempos = tiemposLabels();
    const destino = dir > 0
      ? tiempos.find((t) => t > actual + margen)
      : [...tiempos].reverse().find((t) => t < actual - margen);
    if (destino !== undefined) tl.pause(destino);
  }

  if (dentroDelDeck) {
    conectarControlConDeck(tl, saltarLabel, tiemposLabels);
    reenviarClicsAlDeck();
  }

  document.addEventListener('keydown', (evento) => {
    switch (evento.code) {
      case 'Space':
        evento.preventDefault();
        if (pista) pista.classList.add('oculto');
        if (tl.progress() >= 1) tl.restart();
        else tl.paused(!tl.paused());
        break;
      case 'KeyR':
        tl.pause(0);
        break;
      case 'ArrowRight':
        evento.preventDefault();
        // Si el foco quedó dentro del iframe, el deck no vería la tecla:
        // se la reenviamos para que avance de slide igual que siempre.
        if (dentroDelDeck) avisarAlDeck('siguiente');
        else saltarLabel(+1);
        break;
      case 'ArrowLeft':
        evento.preventDefault();
        if (dentroDelDeck) avisarAlDeck('anterior');
        else saltarLabel(-1);
        break;
      case 'KeyH':
        if (ayuda) ayuda.classList.toggle('oculto');
        break;
    }
  });
}

/* ---------- 3b. Puente con el deck ----------
   Comunicación por postMessage entre la animación (iframe) y el deck (padre).

     animación → deck : 'siguiente' / 'anterior' (teclas o clics en el iframe)
                        'rueda' + delta (la rueda del mouse sobre el iframe)
     deck → animación : 'activar'   (la slide entra: reiniciar desde cero,
                                     o quedarse quieta si es paso a paso)
                        'desactivar' (la slide sale: pausar para no gastar CPU) */
function avisarAlDeck(accion, delta) {
  window.parent.postMessage({ origen: 'animacion', accion, delta }, '*');
}

function escucharAlDeck() {
  window.addEventListener('message', (evento) => {
    if (!evento.data || evento.data.origen !== 'deck') return;
    const tl = timelinePrincipal;
    if (!tl) return;

    if (evento.data.accion === 'activar') {
      pasoAPaso = Boolean(evento.data.pasoAPaso);
      detenerTramo();
      if (!pasoAPaso) tl.restart();
      else tl.pause(evento.data.alFinal ? finPasoAPaso(tl) : inicioPasoAPaso(tl));
    }
    if (evento.data.accion === 'desactivar') {
      detenerTramo();
      tl.pause();
    }
  });
}

/* ---------- 3c. Control con mouse dentro del deck ----------
   En la charla puede que solo haya un mouse, sin teclado. La barra de
   control (reiniciar, paso a paso, play/pausa) la dibuja el deck DEBAJO del
   iframe, para que no tape la animación. Aquí solo se atiende:

     deck → animación : 'reiniciar', 'paso-anterior', 'paso-siguiente',
                        'alternar' (órdenes de los botones de la barra)
     animación → deck : 'estado' + { pausada, paso, total } cuando cambia,
                        para que la barra muestre play/pausa y el paso
                        'mouse' (el mouse se movió encima: mostrar la barra)
                        'siguiente' / 'anterior' / 'rueda' (clics y rueda) */
function conectarControlConDeck(tl, saltarLabel, tiemposLabels) {
  window.addEventListener('message', (evento) => {
    if (!evento.data || evento.data.origen !== 'deck') return;
    const accion = evento.data.accion;
    if (accion === 'reiniciar') {
      detenerTramo();
      if (pasoAPaso) tl.pause(inicioPasoAPaso(tl));
      else tl.restart();
    }
    if (accion === 'avanzar') avanzarTramo(tl, tiemposLabels);
    if (accion === 'retroceder') retrocederTramo(tl, tiemposLabels);
    if (accion === 'paso-anterior') saltarLabel(-1);
    if (accion === 'paso-siguiente') saltarLabel(+1);
    if (accion === 'alternar') {
      if (tl.progress() >= 1) tl.restart();
      else tl.paused(!tl.paused());
    }
    // Al entrar en la slide se reenvía aunque no haya cambiado, porque la
    // barra es una sola para todas las slides.
    if (accion === 'activar') ultimo = '';
    avisarEstado();
  });

  // Mientras la animación corre, el paso cambia solo: se comprueba en cada
  // frame de GSAP. Pero con la timeline en pausa GSAP deja de emitir frames,
  // por eso además se avisa justo después de cada orden del deck.
  let ultimo = '';
  gsap.ticker.add(avisarEstado);
  function avisarEstado() {
    const tiempos = tiemposLabels();
    const paso = tiempos.filter((t) => t <= tl.time() + 0.01).length;
    const estado = `${tl.paused()}|${paso}|${tiempos.length}`;
    if (estado === ultimo) return;
    ultimo = estado;
    window.parent.postMessage({
      origen: 'animacion',
      accion: 'estado',
      pausada: tl.paused(),
      paso,
      total: tiempos.length,
    }, '*');
  }

  // El deck no ve el mouse cuando está sobre el iframe: se le avisa, como
  // mucho cada 200 ms, para que muestre la barra y las flechas.
  let ultimoAviso = 0;
  document.addEventListener('mousemove', () => {
    const ahora = performance.now();
    if (ahora - ultimoAviso < 200) return;
    ultimoAviso = ahora;
    avisarAlDeck('mouse');
  });
}

// El iframe se traga los clics: sin esto, hacer clic sobre la animación no
// cambiaría de slide y el presentador tendría que apuntar fuera de ella.
function reenviarClicsAlDeck() {
  // Navegando a clics, un doble clic rápido seleccionaría texto de la escena
  document.body.style.userSelect = 'none';
  document.addEventListener('click', (evento) => {
    if (evento.button !== 0) return;
    avisarAlDeck('siguiente');
  });
  document.addEventListener('contextmenu', (evento) => {
    evento.preventDefault();
    avisarAlDeck('anterior');
  });
  // La rueda se manda cruda: el deck decide cuándo cuenta como un cambio de
  // slide, así el ritmo es el mismo dentro y fuera de la animación.
  document.addEventListener('wheel', (evento) => {
    evento.preventDefault();
    avisarAlDeck('rueda', evento.deltaY);
  }, { passive: false });
}

/* ---------- 3d. Modo paso a paso ----------
   Para explicar un ejemplo línea por línea. Con el atributo
   data-paso-a-paso en el iframe, el deck ya no cambia de slide al avanzar:
   manda 'avanzar' y la animación REPRODUCE el tramo hasta el siguiente label
   y se detiene ahí. En el último label responde 'fin-adelante' y entonces sí
   cambia de slide. 'retroceder' salta sin animar al label anterior, o
   responde 'fin-atras' si ya está en el primero.

   Arranca en el SEGUNDO label: el primero ("inicio") solo abre el silencio
   de DUR.margen, y con él el primer clic no haría nada visible. */
function inicioPasoAPaso(tl) {
  const tiempos = Object.values(tl.labels).sort((a, b) => a - b);
  return tiempos.length > 1 ? tiempos[1] : 0;
}

// Al volver desde la slide siguiente se llega al último label y no a
// tl.duration(): con la timeline en bucle, el final exacto daría la vuelta a 0.
function finPasoAPaso(tl) {
  return Math.max(0, ...Object.values(tl.labels));
}

function detenerTramo() {
  if (tweenPaso) tweenPaso.kill();
  tweenPaso = null;
}

function avanzarTramo(tl, tiemposLabels) {
  // Clic con un tramo a medias: se termina de golpe, como en PowerPoint.
  // progress() y no isActive(): este da false hasta el primer frame, y un
  // doble clic rápido empezaba otro tramo en vez de terminar el actual.
  if (tweenPaso && tweenPaso.progress() < 1) {
    tweenPaso.progress(1);
    detenerTramo();
    return;
  }
  const destino = tiemposLabels().find((t) => t > tl.time() + 0.01);
  if (destino === undefined) {
    avisarAlDeck('fin-adelante');
    return;
  }
  tl.pause();
  tweenPaso = tl.tweenTo(destino);
}

function retrocederTramo(tl, tiemposLabels) {
  detenerTramo();
  const destino = [...tiemposLabels()].reverse().find((t) => t < tl.time() - 0.01);
  if (destino === undefined || destino < inicioPasoAPaso(tl)) {
    avisarAlDeck('fin-atras');
    return;
  }
  tl.pause(destino);
}

/* ---------- 4b. Navegación entre animaciones ----------
   configurarNavegacion() agrega botones "Anterior" y "Siguiente" para navegar
   entre las animaciones de la presentación Event Loop. */
function configurarNavegacion() {
  // Dentro del deck navega el deck: estos botones sobrarían en pantalla.
  if (dentroDelDeck) return;

  const archivos = [
    '01-single-thread.html',
    '02-sincrono.html',
    '03-event-loop-callbacks.html',
    '04-call-stack.html',
    '05-event-loop.html',
    '06-web-apis.html',
    '07-web-apis-categorias.html',
    '08-macrotask-queue.html',
    '09-microtask-queue.html',
    '10-ejemplo-settimeout.html',
    '11-ejemplo-promise.html',
    '12-ejemplo-promesas-encadenadas.html'
  ];

  const url = new URL(window.location);
  const path = url.pathname;
  const nombreArchivo = path.split('/').pop();

  const numeroActual = archivos.indexOf(nombreArchivo) + 1;
  if (numeroActual === 0) return; // No es un archivo conocido

  const numeroAnterior = numeroActual - 1;
  const numeroSiguiente = numeroActual + 1;

  const nav = document.createElement('nav');
  nav.className = 'animacion-nav';

  let html = '<div class="animacion-nav__contenedor">';

  if (numeroAnterior >= 1) {
    html += `<a href="${archivos[numeroAnterior - 1]}" class="animacion-nav__boton animacion-nav__anterior">← Anterior</a>`;
  }

  html += `<span class="animacion-nav__numero">${String(numeroActual).padStart(2, '0')}/${archivos.length}</span>`;

  if (numeroSiguiente <= archivos.length) {
    html += `<a href="${archivos[numeroSiguiente - 1]}" class="animacion-nav__boton animacion-nav__siguiente">Siguiente →</a>`;
  }

  html += '</div>';
  nav.innerHTML = html;
  document.body.appendChild(nav);
}

/* ---------- 4. Utilidades de escena ----------
   Pequeños helpers que agregan tweens a una timeline. Todos reciben la
   timeline, el elemento y (opcional) la posición dentro de la timeline,
   igual que tl.to(). Devuelven la timeline para poder encadenar.

   Los elementos ya existen en el HTML (ocultos con visibility/opacity), así
   que la timeline se puede rebobinar y recorrer con las flechas sin
   problemas. */

// Mueve la barra de resaltado a la línea `numero` (1 = primera línea) del
// panel de código. Si `numero` es null, oculta la barra.
function resaltarLinea(tl, numero, posicion) {
  const barra = document.querySelector('.codigo__resaltado');
  if (numero === null) {
    return tl.to(barra, { autoAlpha: 0, duration: DUR.rapida }, posicion);
  }
  const linea = document.querySelectorAll('.codigo .linea')[numero - 1];
  return tl.to(barra, {
    y: linea.offsetTop,
    autoAlpha: 1,
    duration: DUR.rapida,
    ease: EASE.mover,
  }, posicion);
}

// Un frame entra al Call Stack (aparece desde abajo)
function apilar(tl, elemento, posicion) {
  return tl.fromTo(elemento,
    { autoAlpha: 0, y: 40, scale: 0.9 },
    { autoAlpha: 1, y: 0, scale: 1, duration: DUR.normal, ease: EASE.entrada },
    posicion);
}

// Un frame sale del Call Stack (se desvanece hacia arriba)
function desapilar(tl, elemento, posicion) {
  return tl.to(elemento,
    { autoAlpha: 0, y: -40, scale: 0.9, duration: DUR.normal, ease: EASE.salida },
    posicion);
}

// Un item entra a Web APIs o a una cola (aparece desde la derecha)
function encolar(tl, elemento, posicion) {
  return tl.fromTo(elemento,
    { autoAlpha: 0, x: 60 },
    { autoAlpha: 1, x: 0, duration: DUR.normal, ease: EASE.entrada },
    posicion);
}

// Un item sale de Web APIs o de una cola (se va hacia la izquierda)
function desencolar(tl, elemento, posicion) {
  return tl.to(elemento,
    { autoAlpha: 0, x: -60, duration: DUR.normal, ease: EASE.salida },
    posicion);
}

// Una línea aparece en la consola
function imprimir(tl, elemento, posicion) {
  return tl.fromTo(elemento,
    { autoAlpha: 0, x: -24 },
    { autoAlpha: 1, x: 0, duration: DUR.normal, ease: EASE.suave },
    posicion);
}

// Pausa vacía de `segundos` para dejar leer al espectador
function esperar(tl, segundos = DUR.pausa, posicion) {
  return tl.to({}, { duration: segundos }, posicion);
}
