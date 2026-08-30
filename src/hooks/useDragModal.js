import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const DRAG_START_THRESHOLD = 8; // px antes de reconocer drag
const CLOSE_DISTANCE_THRESHOLD = 100; // px arrastrados para cerrar
const CLOSE_VELOCITY_THRESHOLD = 500; // px/s en release para cerrar
// Shrink progresivo: cuanto más arrastra el usuario, más chica se
// hace la modal. Da sensación de "colapsando hacia el destino" y
// hace que si suelta el drag y cerramos, la transición al trigger
// sea visualmente más continua (la modal ya está encaminada al
// tamaño chico).
const MAX_SHRINK_DISTANCE = 200; // px donde se topa la escala
const MIN_SCALE = 0.88; // escala mínima (12% de encogimiento)
// Tolerancia al medir si un scroller llegó al final. scrollTop es
// fraccional en pantallas con devicePixelRatio no entero, así que
// comparar con igualdad exacta falla justo en el borde.
const SCROLL_EDGE_TOLERANCE = 1; // px

/**
 * Sube desde `start` hasta `boundary` (inclusive) buscando el primer
 * ancestro que scrollee verticalmente de verdad: que tenga overflow-y
 * auto/scroll Y contenido que desborde. Devuelve null si no hay ninguno.
 *
 * Necesitamos el elemento REAL (no asumir que es el content del modal)
 * porque el drag puede arrancar sobre un scroller anidado, y en ese caso
 * el que decide si el gesto es scroll o drag es ese, no el de afuera.
 */
function findVerticalScroller(start, boundary) {
  let node = start instanceof Element ? start : start?.parentElement;
  while (node) {
    if (node.scrollHeight - node.clientHeight > SCROLL_EDGE_TOLERANCE) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return node;
    }
    if (node === boundary) break;
    node = node.parentElement;
  }
  return null;
}

/**
 * DRAG PARA CERRAR
 *
 * Habilita drag (mouse o touch) sobre la modal. Si el usuario arrastra
 * más de CLOSE_DISTANCE_THRESHOLD o suelta con velocidad superior a
 * CLOSE_VELOCITY_THRESHOLD, se dispara `onDragClose` — normalmente el
 * cierre estándar del modal, que vuela con FLIP de vuelta al trigger
 * igual que si el usuario hubiera clickeado la X. Si no llega al
 * umbral, spring-back.
 *
 * POR QUÉ FUNCIONA SIN TOCAR EL CIERRE:
 * El cierre FLIP captura el estado inicial con Flip.getState, que lee
 * getBoundingClientRect. Ese método devuelve la posición VISUAL del
 * elemento (con transforms aplicados) — o sea, dónde quedó la modal
 * después del drag. Después el cierre limpia el transform y arma un
 * Flip.from que anima desde esa posición visual hasta el trigger.
 * Cero cambios extra en la lógica de cierre.
 *
 * COORDINACIÓN CON SCROLL:
 * El drag arranca desde CUALQUIER punto de la modal, incluido el
 * content scrolleable. La única pregunta es de quién es el gesto, y se
 * decide una sola vez, al superar el umbral:
 *
 *   - Mouse/pen: siempre gana el drag. Arrastrar con el mouse nunca
 *     scrollea (para eso está la rueda), así que no hay conflicto que
 *     resolver. Lo único que se pierde es seleccionar texto arrastrando.
 *   - Touch, gesto dominante horizontal: gana el drag. El content solo
 *     scrollea en vertical, tampoco hay conflicto.
 *   - Touch, gesto dominante vertical sobre un scroller: gana el drag
 *     SOLO si ese scroller ya está en el borde en esa dirección. Si
 *     todavía le queda recorrido, soltamos el gesto y el browser
 *     scrollea nativo. Es el mismo criterio que usan los bottom-sheets
 *     de iOS y Android.
 *
 * La decisión se toma UNA vez (en el frame que cruza el umbral) y no se
 * revisa después. Reevaluar frame a frame hace que el gesto cambie de
 * dueño a mitad de camino y se siente roto.
 *
 * UMBRAL DE INICIO (DRAG_START_THRESHOLD):
 * No declaramos drag hasta que el pointer se mueva 8px del origen.
 * Sin esto, cualquier micro-jitter del mouse convertía un click en
 * drag y bloqueaba clicks reales sobre botones/inputs de la modal.
 *
 * POINTER EVENTS:
 * Usamos Pointer Events (no touch/mouse por separado) para tener un
 * único código que cubre mouse, touch y pen. setPointerCapture asegura
 * que los eventos siguen llegando aunque el pointer se salga del modal.
 */
export const useDragModal = ({
  isOpen,
  modalRef,
  onDragClose,
  // Se llama UNA vez, en el instante en que el drag gana el gesto y antes
  // de tocar el modal. Sirve para que el dueño del modal deje cualquier
  // animación en curso en un estado final coherente (ver useFlipModal:
  // termina la apertura y hace el swap de los shared elements). Sin esto,
  // el drag mataría la apertura a mitad de vuelo y dejaría phantoms
  // huérfanos volando y los targets ocultos para siempre.
  onDragStart,
  // Opt-in: por default no aplicamos drag para no cambiar el comportamiento
  // de modales existentes. Los modales que lo quieran pasan dragToClose={true}.
  dragToClose = false,
}) => {
  // La ref para onDragClose evita que el useEffect se re-monte cada vez
  // que la función cambia de identidad (que puede pasar si el parent no
  // memoiza onClose). Sin la ref agregábamos y sacábamos listeners en
  // cada render — barato pero contamina profile.
  const closeRef = useRef(onDragClose);
  useEffect(() => {
    closeRef.current = onDragClose;
  }, [onDragClose]);

  const startRef = useRef(onDragStart);
  useEffect(() => {
    startRef.current = onDragStart;
  }, [onDragStart]);

  useEffect(() => {
    // Opt-in: si el modal no pidió dragToClose, ni siquiera montamos los
    // listeners. Así no pagamos ningún costo (memoria, event dispatch) en
    // modales que no lo necesitan.
    if (!dragToClose) return;
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    let drag = null;

    const onPointerDown = (e) => {
      // Solo botón primario del mouse; touch/pen sin restricción
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        // Resolvemos el scroller ACÁ y no en el move: en el move el
        // pointer ya puede estar sobre otro elemento (o fuera del modal
        // por el pointer capture), y el dueño del gesto lo define dónde
        // EMPEZÓ, no dónde está ahora.
        scroller: findVerticalScroller(e.target, modal),
        startX: e.clientX,
        startY: e.clientY,
        // baseX/baseY se capturan en el momento que se supera el threshold
        // del drag (ver onPointerMove). NO acá, porque queremos que si
        // el usuario solo tapea sin mover, el tween que estuviera
        // corriendo (ej: spring-back) siga sin interrumpirse.
        baseX: 0,
        baseY: 0,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
        velocityX: 0,
        velocityY: 0,
        started: false,
      };
    };

    const onPointerMove = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const now = performance.now();
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dt = now - drag.lastTime;
      // Velocity instantánea (solo el último tramo) — mejor predictor
      // de intención del usuario que velocity promedio de todo el drag.
      if (dt > 0) {
        drag.velocityX = ((e.clientX - drag.lastX) / dt) * 1000;
        drag.velocityY = ((e.clientY - drag.lastY) / dt) * 1000;
      }
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastTime = now;

      if (!drag.started) {
        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD) return;

        // ── ¿DE QUIÉN ES EL GESTO? ──
        // Solo hay que arbitrar cuando el gesto arrancó sobre algo que
        // scrollea y viene de un dedo: ahí drag y scroll compiten por el
        // mismo movimiento. Con mouse/pen no compiten (la rueda scrollea).
        if (drag.scroller && drag.pointerType === "touch") {
          const verticalIntent = Math.abs(dy) > Math.abs(dx);
          if (verticalIntent) {
            const { scrollTop, scrollHeight, clientHeight } = drag.scroller;
            // dy > 0 = dedo hacia abajo = el content sube = consume
            // scroll de arriba. Solo hay recorrido si scrollTop > 0.
            const hasRoom =
              dy > 0
                ? scrollTop > SCROLL_EDGE_TOLERANCE
                : scrollTop <
                  scrollHeight - clientHeight - SCROLL_EDGE_TOLERANCE;
            if (hasRoom) {
              // El gesto es del scroller. Nos bajamos del todo (drag =
              // null) en vez de solo no arrancar: así el resto del gesto
              // no vuelve a evaluarse y el browser scrollea sin que le
              // toquemos un solo preventDefault.
              drag = null;
              return;
            }
          }
        }

        drag.started = true;

        // PRIMERO asentar, DESPUÉS medir. El orden no es negociable:
        // settle deja el modal en su posición final de apertura, y recién
        // ahí baseX/baseY (más abajo) leen un valor que significa algo.
        // Al revés mediríamos la posición a mitad del vuelo de apertura y
        // el modal pegaría un salto al primer pointermove.
        startRef.current?.();

        try {
          modal.setPointerCapture(e.pointerId);
        } catch {
          // Algunos browsers pueden fallar (elemento no focusable);
          // ignoramos — los eventos igual siguen bubbleando al modal.
        }
        modal.style.userSelect = "none";
        modal.style.cursor = "grabbing";
        // Matamos cualquier tween activo sobre el modal (ej: un
        // spring-back previo que todavía no terminó). Sin esto el drag
        // "compite" con el tween y el modal tembla.
        gsap.killTweensOf(modal);
        // Capturamos la posición ACTUAL del modal (leída de GSAP, así
        // respeta cualquier tween que estuviera corriendo hasta el
        // frame anterior) como base para sumar el dx/dy del drag.
        //
        // Sin esto, si el usuario agarraba mid-spring-back, ocurría lo
        // siguiente: killTweensOf congelaba el tween en (x=30, y=15),
        // pero después aplicábamos `gsap.set(modal, { x: dx, y: dy })`
        // usando dx/dy medidos desde el punto de grab (arrancando en 0)
        // → la modal saltaba visualmente de (30,15) a (dx,dy) — flip-flop.
        // Ahora modal.x = baseX + dx, así continúa desde donde estaba.
        drag.baseX = Number(gsap.getProperty(modal, "x")) || 0;
        drag.baseY = Number(gsap.getProperty(modal, "y")) || 0;
      }

      // preventDefault evita selección de texto con mouse y prevención
      // de gestos default del browser durante el drag.
      if (e.cancelable) e.preventDefault();

      // Total displacement = base (donde el modal estaba al empezar el
      // drag efectivo) + movimiento del pointer desde el grab.
      const totalX = drag.baseX + dx;
      const totalY = drag.baseY + dy;

      // Escala progresiva basada en la distancia TOTAL desde el origen,
      // con curva ease-out cuadrática:
      //   eased(t) = 1 - (1-t)^2     donde t = distancia/MAX
      // Uso distancia total (no solo el movimiento del drag actual)
      // porque el scale es una función del "cuán lejos está la modal de
      // su posición de reposo" — así queda consistente si el usuario
      // agarra la modal ya desplazada y sigue arrastrando.
      const distance = Math.hypot(totalX, totalY);
      const t = Math.min(distance / MAX_SHRINK_DISTANCE, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const scale = 1 - eased * (1 - MIN_SCALE);

      gsap.set(modal, { x: totalX, y: totalY, scale });
    };

    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const state = drag;
      drag = null;
      // Si nunca superó el threshold, fue un click — no hacemos nada
      // (dejamos que el click event burbujee normal a lo que sea).
      if (!state.started) return;
      try {
        modal.releasePointerCapture(state.pointerId);
      } catch {
        // Ignoramos; releasePointerCapture puede fallar si nunca se
        // llegó a capturar (ver setPointerCapture arriba).
      }
      modal.style.removeProperty("user-select");
      modal.style.removeProperty("cursor");

      const distance = Math.hypot(
        state.lastX - state.startX,
        state.lastY - state.startY,
      );
      const velocity = Math.hypot(state.velocityX, state.velocityY);

      if (
        distance > CLOSE_DISTANCE_THRESHOLD ||
        velocity > CLOSE_VELOCITY_THRESHOLD
      ) {
        // Cerrar. El cierre usa Flip.getState → getBoundingClientRect,
        // que lee la posición VISUAL (con el translate del drag). El
        // cierre naturalmente arranca desde donde el usuario soltó y
        // vuela al trigger. No necesitamos limpiar el transform antes;
        // el clearProps que hace el cierre más adelante ya lo maneja.
        closeRef.current?.();
      } else {
        // Spring back al origen. power3.out es sutil sin overshoot
        // ruidoso — se siente responsive sin "rebote de goma".
        // Reseteamos también scale porque el drag la achicó — sin esto
        // la modal se queda encogida después del release.
        gsap.to(modal, {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.3,
          ease: "power3.out",
        });
      }
    };

    // Ahora que el drag arranca desde cualquier lado, el mouse pasa por
    // encima de <img> y <a>, que tienen drag nativo del browser (HTML5
    // drag & drop). Sin esto, arrastrar una imagen dispara dragstart, el
    // browser se queda con el gesto y muestra su preview fantasma —
    // nuestros pointermove dejan de llegar y la modal queda a medio
    // camino. Cancelamos dragstart mientras el drag-to-close esté vivo.
    const onDragStart = (e) => {
      e.preventDefault();
    };

    modal.addEventListener("pointerdown", onPointerDown);
    modal.addEventListener("pointermove", onPointerMove);
    modal.addEventListener("pointerup", onPointerUp);
    modal.addEventListener("pointercancel", onPointerUp);
    modal.addEventListener("dragstart", onDragStart);

    return () => {
      modal.removeEventListener("pointerdown", onPointerDown);
      modal.removeEventListener("pointermove", onPointerMove);
      modal.removeEventListener("pointerup", onPointerUp);
      modal.removeEventListener("pointercancel", onPointerUp);
      modal.removeEventListener("dragstart", onDragStart);
    };
  }, [dragToClose, isOpen, modalRef]);
};
