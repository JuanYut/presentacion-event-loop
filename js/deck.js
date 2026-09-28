/* ============================================================
   js/deck.js
   Motor de la presentación. Sin dependencias ni build: se carga con una
   etiqueta <script> y funciona abriendo index.html con doble clic.

   Secciones:
     1. Estado y referencias
     2. Escalado del lienzo 1920x1080
     3. Cambio de slide (y carga diferida de las animaciones)
     4. Teclado, ratón y pantalla completa
     5. Mensajes que llegan desde las animaciones
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
// empezar, no a mitad del bucle.
function avisarAnimacion(indice, accion) {
  const slide = slides[indice];
  if (!slide) return;
  slide.querySelectorAll('iframe').forEach((marco) => {
    if (!marco.contentWindow) return;
    marco.contentWindow.postMessage({ origen: 'deck', accion }, '*');
  });
}

function ir(indice, { reemplazarHash = false } = {}) {
  const destino = Math.max(0, Math.min(indice, slides.length - 1));
  const anterior = actual;

  if (destino !== anterior) avisarAnimacion(anterior, 'desactivar');

  slides[anterior].classList.remove('activa');
  slides[destino].classList.add('activa');
  actual = destino;

  // La de la slide actual primero, y las vecinas después para la siguiente vez
  cargarAnimacion(destino);
  cargarAnimacion(destino + 1);
  cargarAnimacion(destino - 1);

  // El iframe puede no haber terminado de cargar la primera vez que llegamos:
  // en ese caso el 'activar' se manda en su evento load (ver sección 6).
  avisarAnimacion(destino, 'activar');

  progreso.style.width = `${((destino + 1) / slides.length) * 100}%`;
  contador.textContent = `${destino + 1} / ${slides.length}`;
  btnAnterior.disabled = destino === 0;
  btnSiguiente.disabled = destino === slides.length - 1;

  // El hash mantiene la posición si se recarga la página a mitad de la charla.
  const hash = `#${destino + 1}`;
  if (reemplazarHash) history.replaceState(null, '', hash);
  else if (location.hash !== hash) history.pushState(null, '', hash);
}

const siguiente = () => ir(actual + 1);
const anterior = () => ir(actual - 1);

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
  temporizadorRaton = setTimeout(() => deck.classList.remove('raton-activo'), 2000);
}

/* ---------- 5. Mensajes desde las animaciones ----------
   Si el foco cae dentro de un iframe (por ejemplo al hacer clic en la
   animación), las teclas las recibe la animación y no el deck. controls.js
   reenvía las de navegación por postMessage y aquí las atendemos. */
function alRecibirMensaje(evento) {
  if (!evento.data || evento.data.origen !== 'animacion') return;
  if (evento.data.accion === 'siguiente') siguiente();
  if (evento.data.accion === 'anterior') anterior();
}

/* ---------- 6. Arranque ---------- */
window.addEventListener('resize', escalarLienzo);
document.addEventListener('keydown', alPulsarTecla);
document.addEventListener('mousemove', alMoverRaton);
window.addEventListener('message', alRecibirMensaje);
btnAnterior.addEventListener('click', anterior);
btnSiguiente.addEventListener('click', siguiente);

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
