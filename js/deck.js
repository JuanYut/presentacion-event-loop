/* ============================================================
   js/deck.js
   Motor de la presentación. Sin dependencias ni build: se carga con una
   etiqueta <script> y funciona abriendo index.html con doble clic.

   Secciones:
     1. Estado y referencias
     2. Escalado del lienzo 1920x1080
     3. Cambio de slide (y carga diferida de las animaciones)
        3b. Pasos dentro de una slide (bullets que aparecen de uno en uno)
     3c. Animaciones paso a paso (avanzar mueve la animación, no la slide)
     4. Teclado, ratón y pantalla completa (clic, clic derecho y rueda)
     5. Mensajes que llegan desde las animaciones
     5b. Barra de control de la animación (debajo del iframe)
     6. Arranque
   ============================================================ */

/* ---------- 1. Estado y referencias ---------- */
const deck = document.querySelector('.deck');
const slides = Array.from(document.querySelectorAll('.slide'));
const progreso = document.querySelector('.barra__progreso');
const contador = document.querySelector('.contador');
const ayuda = document.querySelector('.ayuda-deck');
const btnAnterior = document.querySelector('.flechas__anterior');
const btnSiguiente = document.querySelector('.flechas__siguiente');
const barraControl = document.querySelector('.control-animacion');
const textoPaso = document.querySelector('.control-animacion__paso');

let actual = 0;

/* ---------- 2. Escalado del lienzo ----------
   Mismo truco que usan las animaciones: el lienzo mide 1920x1080 en píxeles y
   se escala para caber en la ventana. Así el diseño no cambia entre pantallas.
   Math.min sin topes evita deformación y también permite ampliar en monitores
   grandes. */
function escalarLienzo() {
  const escala = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  deck.style.setProperty('--escala', escala);
}

/* ---------- 3. Cambio de slide ---------- */

// Carga el iframe de una slide solo cuando hace falta. Precargamos también las
// vecinas para que al avanzar la animación ya esté lista y no se vea el hueco.
function cargarAnimacion(indice) {
  const slide = slides[indice];
  if (!slide) return;
  slide.querySelectorAll('iframe[data-src]').forEach((marco) => {
    marco.src = marco.dataset.src;
    delete marco.dataset.src;   // marca de "ya cargada"
  });
}

// Avisa a la animación de una slide que entra o sale de pantalla.
// 'activar' la reinicia desde cero: al llegar a la slide el público la ve
// empezar, no a mitad del bucle. Las de data-paso-a-paso no arrancan solas:
// esperan a que el presentador avance (sección 3c).
function avisarAnimacion(indice, accion, extra = {}) {
  const slide = slides[indice];
  if (!slide) return;
  slide.querySelectorAll('iframe').forEach((marco) => {
    if (!marco.contentWindow) return;
    marco.contentWindow.postMessage({
      origen: 'deck',
      accion,
      pasoAPaso: marco.hasAttribute('data-paso-a-paso'),
      ...extra,
    }, '*');
  });
}

function ir(indice, { reemplazarHash = false, conPasosVisibles = false } = {}) {
  const destino = Math.max(0, Math.min(indice, slides.length - 1));
  const anterior = actual;

  if (destino !== anterior) {
    avisarAnimacion(anterior, 'desactivar');
    // Al llegar avanzando, los pasos empiezan escondidos; al llegar
    // retrocediendo, ya se habían mostrado todos y así se reencuentran.
    pasosDe(destino).forEach((paso) => paso.classList.toggle('visible', conPasosVisibles));
  }

  slides[anterior].classList.remove('activa');
  slides[destino].classList.add('activa');
  actual = destino;

  // La de la slide actual primero, y las vecinas después para la siguiente vez
  cargarAnimacion(destino);
  cargarAnimacion(destino + 1);
  cargarAnimacion(destino - 1);

  // El iframe puede no haber terminado de cargar la primera vez que llegamos:
  // en ese caso el 'activar' se manda en su evento load (ver sección 6).
  // Al volver desde la slide siguiente, una animación paso a paso se
  // reencuentra terminada, igual que los pasos .aparece.
  avisarAnimacion(destino, 'activar', { alFinal: conPasosVisibles });
  colocarBarraControl(destino);

  // La barra y el contador son tinta sobre amarillo: en las slides negras
  // desaparecerían, así que se invierten junto con la slide.
  deck.classList.toggle('deck--oscura', slides[destino].classList.contains('slide--oscura'));

  progreso.style.width = `${((destino + 1) / slides.length) * 100}%`;
  contador.textContent = `${destino + 1} / ${slides.length}`;
  btnAnterior.disabled = destino === 0;
  btnSiguiente.disabled = destino === slides.length - 1;

  // El hash mantiene la posición si se recarga la página a mitad de la charla.
  const hash = `#${destino + 1}`;
  if (reemplazarHash) history.replaceState(null, '', hash);
  else if (location.hash !== hash) history.pushState(null, '', hash);
}

/* ---------- 3b. Pasos dentro de una slide ----------
   Los elementos con class="aparece" se muestran de uno en uno: avanzar
   revela el siguiente y solo cuando ya se ven todos pasa de slide.
   Retroceder los esconde en orden inverso. Como todo (teclas, clic, rueda,
   mensajes de las animaciones) pasa por siguiente() y anterior(), funciona
   igual con cualquier forma de avanzar. */
function pasosDe(indice) {
  return Array.from(slides[indice].querySelectorAll('.aparece'));
}

function siguiente() {
  const pendiente = pasosDe(actual).find((paso) => !paso.classList.contains('visible'));
  if (pendiente) pendiente.classList.add('visible');
  else if (esPasoAPaso(actual)) avisarAnimacion(actual, 'avanzar');
  else ir(actual + 1);
}

function anterior() {
  const mostrados = pasosDe(actual).filter((paso) => paso.classList.contains('visible'));
  if (mostrados.length) mostrados[mostrados.length - 1].classList.remove('visible');
  else if (esPasoAPaso(actual)) avisarAnimacion(actual, 'retroceder');
  else ir(actual - 1, { conPasosVisibles: true });
}

/* ---------- 3c. Animaciones paso a paso ----------
   Para explicar un ejemplo línea por línea: con data-paso-a-paso en el
   iframe, avanzar le pide a la animación que reproduzca su siguiente tramo
   en vez de cambiar de slide. Ella sabe cuándo se le acabaron los tramos y
   lo avisa con 'fin-adelante' / 'fin-atras' (sección 5). Así sirve igual con
   teclas, clic, rueda y mando. */
function esPasoAPaso(indice) {
  const marco = slides[indice].querySelector('iframe[data-paso-a-paso]');
  return Boolean(marco && marco.contentWindow);
}

/* ---------- 4. Teclado, ratón y pantalla completa ----------
   Teclas pensadas para presentar: las de un mando inalámbrico (PageUp/PageDown)
   funcionan igual que las flechas. Espacio avanza, que es lo que espera
   cualquiera acostumbrado a PowerPoint o Google Slides. */
function alPulsarTecla(evento) {
  switch (evento.code) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case 'Space':
    case 'Enter':
      evento.preventDefault();
      siguiente();
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
    case 'Backspace':
      evento.preventDefault();
      anterior();
      break;
    case 'Home':
      evento.preventDefault();
      ir(0);
      break;
    case 'End':
      evento.preventDefault();
      ir(slides.length - 1);
      break;
    case 'KeyF':
      alternarPantallaCompleta();
      break;
    case 'KeyH':
      ayuda.classList.toggle('oculto');
      break;
    case 'Escape':
      ayuda.classList.add('oculto');
      break;
  }
}

function alternarPantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

// Los botones solo se muestran mientras se usa el ratón; tras un par de
// segundos quietos desaparecen y la slide queda limpia.
let temporizadorRaton;
function alMoverRaton() {
  deck.classList.add('raton-activo');
  clearTimeout(temporizadorRaton);
  temporizadorRaton = setTimeout(function esconder() {
    // Si el mouse está quieto encima de la barra, se está usando: no quitarla
    if (barraControl.matches(':hover')) temporizadorRaton = setTimeout(esconder, 1000);
    else deck.classList.remove('raton-activo');
  }, 2000);
}

// Presentar solo con un mouse: clic izquierdo avanza y derecho retrocede,
// como en PowerPoint. Los botones propios (flechas, ayuda) no cuentan como
// "clic en la slide". Dentro de las animaciones hace lo mismo controls.js.
function alHacerClic(evento) {
  if (evento.button !== 0) return;
  if (evento.target.closest('button, a')) return;
  if (!ayuda.classList.contains('oculto')) {
    ayuda.classList.add('oculto');
    return;
  }
  siguiente();
}

function alHacerClicDerecho(evento) {
  evento.preventDefault();   // sin el menú contextual del navegador
  if (evento.target.closest('.control-animacion')) return;
  anterior();
}

// La rueda cambia de slide: hacia abajo avanza, hacia arriba retrocede.
// Una rueda (y sobre todo un touchpad) dispara muchos eventos por gesto, con
// inercia incluida. Por eso, tras cambiar de slide se ignora la rueda hasta
// que lleve 250 ms quieta: un gesto = una slide, sin saltarse varias.
let ruedaBloqueada = false;
let temporizadorRueda;
function alGirarRueda(delta) {
  clearTimeout(temporizadorRueda);
  temporizadorRueda = setTimeout(() => { ruedaBloqueada = false; }, 250);
  if (ruedaBloqueada || Math.abs(delta) < 4) return;
  ruedaBloqueada = true;
  if (delta > 0) siguiente();
  else anterior();
}

/* ---------- 5. Mensajes desde las animaciones ----------
   Si el foco cae dentro de un iframe (por ejemplo al hacer clic en la
   animación), las teclas las recibe la animación y no el deck. controls.js
   reenvía las de navegación por postMessage y aquí las atendemos. */
function alRecibirMensaje(evento) {
  if (!evento.data || evento.data.origen !== 'animacion') return;
  if (evento.data.accion === 'siguiente') siguiente();
  if (evento.data.accion === 'anterior') anterior();
  if (evento.data.accion === 'rueda') alGirarRueda(evento.data.delta);
  if (evento.data.accion === 'mouse') alMoverRaton();
  if (evento.data.accion === 'estado') mostrarEstado(evento);
  // Solo cuenta la animación en pantalla: una vecina no debe cambiar de slide
  const marco = slides[actual].querySelector('iframe');
  if (!marco || evento.source !== marco.contentWindow) return;
  if (evento.data.accion === 'fin-adelante') ir(actual + 1);
  if (evento.data.accion === 'fin-atras') ir(actual - 1, { conPasosVisibles: true });
}

/* ---------- 5b. Barra de control de la animación ----------
   Vive en el deck y no dentro de la animación para poder ponerla DEBAJO del
   iframe: dentro, siempre quedaba encima de algo. Los botones mandan la
   orden a la animación de la slide actual y ella responde con su estado
   (pausada o no, en qué paso va) para pintar la barra. */
function colocarBarraControl(indice) {
  const marco = slides[indice].querySelector('iframe');
  barraControl.classList.toggle('disponible', Boolean(marco));
  if (!marco) return;
  // La slide es absoluta en (0,0) del lienzo, así que offsetLeft/offsetTop
  // del iframe ya son coordenadas del lienzo de 1920x1080.
  barraControl.style.left = `${marco.offsetLeft + marco.offsetWidth / 2}px`;
  barraControl.style.top = `${marco.offsetTop + marco.offsetHeight + 22}px`;
  textoPaso.textContent = '';
  barraControl.classList.remove('pausada');
}

function mostrarEstado(evento) {
  // Las vecinas precargadas también mandan su estado: solo cuenta la actual
  const marco = slides[actual].querySelector('iframe');
  if (!marco || evento.source !== marco.contentWindow) return;
  const { pausada, paso, total } = evento.data;
  barraControl.classList.toggle('pausada', pausada);
  textoPaso.textContent = total > 1 ? `${paso}/${total}` : '';
}

function alPulsarBarraControl(evento) {
  // Que el clic no llegue a alHacerClic y cambie de slide
  evento.stopPropagation();
  const boton = evento.target.closest('button');
  if (boton) avisarAnimacion(actual, boton.dataset.accion);
}

/* ---------- 6. Arranque ---------- */
window.addEventListener('resize', escalarLienzo);
document.addEventListener('keydown', alPulsarTecla);
document.addEventListener('mousemove', alMoverRaton);
document.addEventListener('click', alHacerClic);
document.addEventListener('contextmenu', alHacerClicDerecho);
document.addEventListener('wheel', (evento) => {
  evento.preventDefault();
  alGirarRueda(evento.deltaY);
}, { passive: false });
window.addEventListener('message', alRecibirMensaje);
btnAnterior.addEventListener('click', anterior);
btnSiguiente.addEventListener('click', siguiente);
barraControl.addEventListener('click', alPulsarBarraControl);

// Al terminar de cargar un iframe, si su slide es la que está en pantalla,
// se le manda 'activar' (en ir() todavía no existía su contentWindow listo).
slides.forEach((slide, indice) => {
  slide.querySelectorAll('iframe').forEach((marco) => {
    marco.addEventListener('load', () => {
      if (indice === actual) avisarAnimacion(indice, 'activar');
      else avisarAnimacion(indice, 'desactivar');
    });
  });
});

// Permite abrir la presentación directamente en una slide (index.html#7) y
// que las flechas del navegador funcionen.
window.addEventListener('popstate', () => {
  const numero = parseInt(location.hash.slice(1), 10);
  if (!Number.isNaN(numero)) ir(numero - 1, { reemplazarHash: true });
});

escalarLienzo();
const inicial = parseInt(location.hash.slice(1), 10);
ir(Number.isNaN(inicial) ? 0 : inicial - 1, { reemplazarHash: true });
