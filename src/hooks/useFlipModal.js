import { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";
import { useDragModal } from "@hooks/useDragModal";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Flip, CustomEase);
}

// Curva de apertura: dos segmentos con tangentes continuas en la unión
// (ambas en 0.2, 0.15) para que no haya "jerk" al pasar del primero al
// segundo. El segundo segmento tiene el control 2 en (0.9, 1) para que
// la tangente final sea horizontal y el aterrizaje sea smooth de verdad.
const MODAL_OPEN_EASE = "modalOpen";
const MODAL_OPEN_DURATION = 0.45;

if (typeof window !== "undefined") {
  CustomEase.create(
    MODAL_OPEN_EASE,
    "M0,0 C0.15,0.1 0.2,0.7 0.4,0.85 0.6,1 0.9,1 1,1",
  );
}

/**
 * Busca pares de elementos con el mismo data-shared-id entre un contenedor
 * fuente y un contenedor destino. Retorna un array de objetos { id, source, target }.
 */
function findSharedPairs(sourceContainer, targetContainer, targetModal) {
  if (!sourceContainer || !targetContainer) return [];

  const sourceEls = Array.from(
    sourceContainer.querySelectorAll("[data-shared-id]"),
  );
  const targetEls = Array.from(
    targetContainer.querySelectorAll("[data-shared-id]"),
  ).filter((el) => {
    // Solo incluimos elementos que pertenezcan a ESTE modal
    const closestModal = el.closest("[data-flip-modal-id]");
    return !closestModal || closestModal === targetModal;
  });

  const pairs = [];
  for (const srcEl of sourceEls) {
    const sharedId = srcEl.getAttribute("data-shared-id");
    // Buscamos el primer match en el destino con ese mismo ID
    const tgtEl = targetEls.find(
      (t) => t.getAttribute("data-shared-id") === sharedId,
    );
    if (tgtEl) {
      pairs.push({ id: sharedId, source: srcEl, target: tgtEl });
    }
  }
  return pairs;
}

/**
 * Encuentra el conjunto MÍNIMO de nodos que cubren todo el contenido excepto
 * las ramas que llevan a un shared element. Walk descendente: si un hijo NO
 * tiene ningún data-shared-id adentro, lo agrega entero y no recursa. Si SÍ
 * tiene un shared descendiente, recursa a sus hijos para excluir solo la rama
 * del shared.
 *
 * Antes se hacía content.querySelectorAll("*") y se filtraban ~40 nodos
 * individuales para animarlos. Cada nodo animado con filter/opacity crea su
 * propia capa de compositing, así que 40 nodos = 40 capas GPU. En devices sin
 * GPU dedicada (o en el primer paint del sitio, cuando el compositor todavía
 * no está caliente) esto era el mayor costo del cierre. Ahora agrupamos por
 * ramas y bajamos a ~3-5 nodos animados.
 */
function collectFadeTargets(root) {
  const targets = [];
  const walk = (el) => {
    for (const child of el.children) {
      if (child.hasAttribute("data-shared-id")) continue;
      if (child.querySelector("[data-shared-id]")) {
        walk(child);
      } else {
        targets.push(child);
      }
    }
  };
  walk(root);
  return targets;
}

/**
 * Devuelve el borderRadius de un elemento como un string de 4 valores
 * explícitos "TL TR BR BL" (top-left, top-right, bottom-right, bottom-left),
 * leyendo los longhands reales del computed style. Esto evita ambigüedades
 * del shorthand y garantiza que las 4 esquinas queden bien definidas.
 */
function radiusAsFourCorners(el) {
  const cs = window.getComputedStyle(el);
  return [
    cs.borderTopLeftRadius,
    cs.borderTopRightRadius,
    cs.borderBottomRightRadius,
    cs.borderBottomLeftRadius,
  ].join(" ");
}

/**
 * Crea un clon "fantasma" de un elemento que se posiciona de forma fija
 * sobre el viewport para animar su viaje entre dos posiciones.
 *
 * Si se pasa `targetEl`, copiamos del TARGET (no del source) las props
 * relacionadas al render del texto (fontFamily, fontVariationSettings,
 * lineHeight). El motivo: el source suele tener lineHeight "normal" (~20px
 * para 16px) y el target un lineHeight específico (ej: 40px para text-4xl).
 * Si dejamos el del source, al crecer el fontSize el texto se renderiza
 * con la línea vieja dentro del box nuevo y queda 1-2px corrido. Igual
 * con la font: distintas métricas = baseline distinto. Usamos el lineHeight
 * del target como ratio unitless (40/36 ≈ 1.11) para que escale con el
 * fontSize durante la animación y matchee exacto al final.
 */
function createPhantom(element, rect, targetEl = null) {
  const phantom = element.cloneNode(true);
  const styles = window.getComputedStyle(element);
  const targetStyles = targetEl ? window.getComputedStyle(targetEl) : styles;

  // LineHeight como ratio unitless para que escale con fontSize durante
  // la animación. Si el target no es texto (img), lo dejamos como el del source.
  let lineHeightValue = styles.lineHeight;
  if (targetEl && targetEl.tagName !== "IMG") {
    const tFontSize = parseFloat(targetStyles.fontSize);
    const tLineHeight = parseFloat(targetStyles.lineHeight);
    if (tFontSize > 0 && tLineHeight > 0) {
      lineHeightValue = String(tLineHeight / tFontSize);
    }
  }

  // Limpiamos atributos que podrían causar conflictos
  phantom.removeAttribute("id");
  phantom.removeAttribute("data-shared-id");
  phantom.classList.add("shared-element-phantom");

  // Quitamos las clases `rounded-*` del clon para que el border-radius quede
  // controlado ÚNICAMENTE por el estilo inline que fijamos abajo. Así evitamos
  // que una clase Tailwind (con radio parcial como rounded-ss/t) conflictúe
  // con el radio efectivo visible (el del ancestro con overflow-hidden).
  Array.from(phantom.classList).forEach((cls) => {
    if (cls.startsWith("rounded")) phantom.classList.remove(cls);
  });

  Object.assign(phantom.style, {
    position: "fixed",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "99999",
    pointerEvents: "none",
    borderRadius: radiusAsFourCorners(element),
    objectFit: styles.objectFit || "cover",
    // Matamos cualquier CSS transition que el source tuviera (ej:
    // `transition-all duration-200` en botones). Si la dejáramos, el
    // browser animaría los inline styles de posición/tamaño desde los
    // valores default hasta los del rect ANTES de que GSAP tome control,
    // y cuando el tl.fromTo arranca snap-ea el phantom de vuelta al
    // sourceRect → el botón se ve "tarde" respecto al modal. Los demás
    // shared elements (imagen, título) no tienen transition, por eso
    // esos sí van sincronizados.
    transition: "none",
    // Forzamos white-space:nowrap durante el vuelo para que el texto no
    // se re-wrapee cuando el fontSize cambia. Sin esto, la primera palabra
    // cabe en el ancho del box pero las siguientes bajan a una nueva línea
    // (o se salen del box) y no animan correctamente. Con nowrap, todas
    // las palabras están en una sola línea durante todo el vuelo, creciendo
    // juntas. El snap-to-final al final copia el white-space del target
    // (que puede ser "normal" con wrap) antes de revelar el real.
    whiteSpace: "nowrap",
    // willChange mínimo: solo lo que animatePhantom cambia frame a frame.
    // Antes teníamos 7 props declaradas (border-radius, width, height,
    // top, left...) y cada una reservaba memoria GPU al pedo desde el
    // primer paint del sitio.
    willChange: "transform, opacity",
    // text-rendering:optimizeSpeed → desactiva kerning y ligatures durante
    // el raster del glyph. La mayor fuente de tremble en el phantom cuando
    // el fontSize interpola frame a frame era que el browser recalculaba
    // kerning entre glyphs con métricas ligeramente distintas → posición
    // por-glyph cambiaba subpixel → tremble visible. Sin kerning, los
    // glyphs se posicionan solo por advance width (más estable frame a
    // frame). Como el phantom vive solo 0.4s durante el vuelo y se swappea
    // al target al final, no hay pérdida de calidad tipográfica visible.
    textRendering: "optimizeSpeed",
    fontWeight: styles.fontWeight,
    // Font del TARGET: si source y target usan fonts distintas (ej: el
    // span del botón hereda la del padre, el del modal usa font-dmsans),
    // las métricas son distintas y el glyph queda corrido 1-2px aunque
    // el box esté alineado. Usamos la del target desde el inicio.
    fontFamily: targetStyles.fontFamily,
    fontVariationSettings: targetStyles.fontVariationSettings,
    // LineHeight del target como ratio unitless (ver docstring arriba).
    lineHeight: lineHeightValue,
    letterSpacing: styles.letterSpacing,
    textTransform: styles.textTransform,
    color: styles.color,
  });

  // Forzamos visibilidad con !important. El clon hereda los estilos inline
  // del elemento fuente (ej: visibility:hidden/opacity:0 que fijamos sobre
  // el target durante la apertura si el usuario cierra antes de que termine).
  // Sin esto, el phantom nacería invisible y no se vería el slide de cierre.
  phantom.style.setProperty("visibility", "visible", "important");
  phantom.style.setProperty("opacity", "1", "important");

  document.body.appendChild(phantom);
  return phantom;
}

/**
 * Anima un phantom desde su rect actual hasta un rect destino interpolando
 * posición, tamaño, borderRadius, fontSize y color. Preserva el aspect ratio
 * REAL del phantom frame a frame porque anima width y height como valores
 * independientes (no como scale uniforme), evitando el "aplastado" visible
 * cuando source y target tienen aspect ratios distintos.
 *
 * Cost por frame por shared element: 4 layouts (top/left/w/h) + 1 paint
 * (borderRadius) + 1 layout (fontSize) + 1 paint (color) ≈ 7 ops. Para
 * 1-2 shared elements por modal es aceptable.
 *
 * Usa MODAL_OPEN_EASE (la misma curva que el FLIP de apertura) para que el
 * deslizamiento vaya al mismo ritmo que la apertura del modal.
 * Retorna el timeline de GSAP para poder encadenarlo.
 */
function animatePhantom(
  phantom,
  fromRect,
  toRect,
  fromBorderRadius,
  toBorderRadius,
  {
    duration = 0.6,
    ease = MODAL_OPEN_EASE,
    delay = 0,
    fromFontSize,
    toFontSize,
    fromColor,
    toColor,
  } = {},
) {
  gsap.set(phantom, {
    force3D: true,
    willChange: "transform, opacity",
  });

  const tl = gsap.timeline();

  // 1) Caja: posición, tamaño, borderRadius. Redondeamos solo top/left a
  //    enteros (para evitar subpixel positioning del box). NO redondeamos
  //    width/height porque cuando el recorrido del phantom es corto, el
  //    cambio de width/height por frame es < 1px y el roundProps hacía que
  //    el box se quedara atascado en el tamaño del source durante casi todo
  //    el vuelo, saltando al tamaño del target solo al final.
  tl.fromTo(
    phantom,
    {
      top: fromRect.top,
      left: fromRect.left,
      width: fromRect.width,
      height: fromRect.height,
      borderRadius: fromBorderRadius,
    },
    {
      top: toRect.top,
      left: toRect.left,
      width: toRect.width,
      height: toRect.height,
      borderRadius: toBorderRadius,
      duration,
      ease,
      delay,
      // Redondeo de top/left a enteros: sin esto, el browser renderiza el
      // box en posiciones subpixel cada frame y el texto queda con mucho
      // jitter porque el antialiasing recalcula la posición del glyph.
      roundProps: ["top", "left"],
    },
  );

  // 2) Font-size: interpolamos suavemente sin roundProps. El "step" de 1px
  //    que causaba roundProps era MÁS visible que el jitter subpixel que
  //    intentaba prevenir. En browsers modernos el subpixel raster está
  //    bastante bien optimizado; combinado con text-rendering:optimizeSpeed
  //    en createPhantom (que desactiva kerning por frame) queda smooth.
  if (fromFontSize && toFontSize && fromFontSize !== toFontSize) {
    tl.fromTo(
      phantom,
      { fontSize: fromFontSize },
      { fontSize: toFontSize, duration, ease, delay },
      delay,
    );
  }

  // 3) Color: interpolamos el color de texto del source al del target
  //    para que el texto se funda progresivamente con el estilo del
  //    destino en lugar de saltar al final del swap.
  if (fromColor && toColor && fromColor !== toColor) {
    tl.fromTo(
      phantom,
      { color: fromColor },
      { color: toColor, duration, ease },
      delay,
    );
  }

  return tl;
}

/**
 * Calcula la esquina superior-izquierda que debe ocupar el modal, en coordenadas
 * de viewport. Vive fuera del hook y sin efectos porque se llama en DOS momentos:
 * al abrir y en cada resize de la ventana. Antes esta lógica estaba embebida en
 * el effect de apertura, así que la posición se calculaba UNA sola vez y el modal
 * quedaba clavado en píxeles para siempre.
 *
 * triggerRect puede ser null: en ese caso los modos que dependen del trigger
 * (anchored) caen a centrado.
 */
function computeModalPosition({
  location,
  growDirection,
  margin,
  fullWidth,
  fullHeight,
  triggerRect,
}) {
  // Cálculo de posición final del modal
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let finalLeft;
  let finalTop;

  // Este switch lo usamos para darle una posicion personalizable a la modal.
  // La mayoría de los casos usarán "anchored" (posición relativa al trigger),
  // pero se puede forzar a esquinas o al centro con location="center".
  switch (location) {
    case "top":
      finalLeft = Math.round((vw - fullWidth) / 2);
      finalTop = margin;
      break;
    case "bottom":
      finalLeft = Math.round((vw - fullWidth) / 2);
      finalTop = vh - fullHeight - margin;
      break;
    case "left":
      finalLeft = margin;
      finalTop = Math.round((vh - fullHeight) / 2);
      break;
    case "right":
      finalLeft = vw - fullWidth - margin;
      finalTop = Math.round((vh - fullHeight) / 2);
      break;
    case "top-left":
      finalLeft = margin;
      finalTop = margin;
      break;
    case "top-right":
      finalLeft = vw - fullWidth - margin;
      finalTop = margin;
      break;
    case "bottom-left":
      finalLeft = margin;
      finalTop = vh - fullHeight - margin;
      break;
    case "bottom-right":
      finalLeft = vw - fullWidth - margin;
      finalTop = vh - fullHeight - margin;
      break;
    case "center":
      finalLeft = Math.round((vw - fullWidth) / 2);
      finalTop = Math.round((vh - fullHeight) / 2);
      break;
    case "anchored":
    default:
      if (triggerRect) {
        const r = triggerRect;

        // Lógica de alineación basada en growDirection, osea como hacia donde va a
        // crecer o salir la modal relativa al borde del trigger.
        if (growDirection === "center") {
          // El modal se centra exactamente sobre el trigger
          finalLeft = r.left + (r.width - fullWidth) / 2;
          finalTop = r.top + (r.height - fullHeight) / 2;
        } else {
          // Alineación horizontal: izquierda, derecha o centrado
          if (growDirection.includes("right")) {
            finalLeft = r.left; // Modal alineado al borde izquierdo del trigger
          } else if (growDirection.includes("left")) {
            finalLeft = r.right - fullWidth; // Modal alineado al borde derecho
          } else {
            finalLeft = r.left + (r.width - fullWidth) / 2; // Centrado horizontal
          }

          // Alineación vertical: arriba, abajo o centrado
          if (growDirection.includes("bottom")) {
            finalTop = r.top; // El modal crece hacia abajo desde el top del trigger
          } else if (growDirection.includes("top")) {
            finalTop = r.bottom - fullHeight; // El modal crece hacia arriba
          } else {
            finalTop = r.top + (r.height - fullHeight) / 2; // Centrado vertical
          }
        }

        // Clamping para asegurar que no se salga de la pantalla (usando el margen).
        // Math.max garantiza que no se pase a la izquierda/arriba,
        // Math.min garantiza que no se pase a la derecha/abajo.
        finalLeft = Math.max(
          margin,
          Math.min(finalLeft, vw - fullWidth - margin),
        );
        finalTop = Math.max(
          margin,
          Math.min(finalTop, vh - fullHeight - margin),
        );
      } else {
        // Fallback a center si no hay rect disponible
        finalLeft = Math.round((vw - fullWidth) / 2);
        finalTop = Math.round((vh - fullHeight) / 2);
      }
      break;
  }

  return { left: finalLeft, top: finalTop };
}

export const useFlipModal = ({
  isOpen,
  modalRef,
  contentRef,
  triggerRef,
  overlayRef,
  onClose,
  location,
  growDirection = "bottom-right",
  id,
  margin = 20,
  hideTrigger = true,
  // Opt-in: por default no aplicamos drag para no cambiar el comportamiento
  // de modales existentes. Los modales que lo quieran pasan dragToClose={true}.
  dragToClose = false,
  // Opt-in: si es true el modal devuelve su tamano al CSS al terminar de
  // abrir y recalcula su posicion en cada resize de la ventana. Si es false
  // (default) queda clavado en la geometria que midio al abrir, que es mas
  // barato: cero listeners y cero lecturas de layout mientras esta abierto.
  //
  // Se controla con UN solo flag porque las dos mitades no sirven por
  // separado: liberar el tamano sin reposicionar deja el modal creciendo
  // desde un top/left viejo, y reposicionar sin liberar el tamano calcula
  // la posicion con medidas que ya no son las reales.
  responsive = false,
}) => {
  // Puente entre la animación de apertura y el drag-to-close: mientras la
  // apertura está en vuelo, acá vive una función que la termina de golpe.
  // Vale null cuando no hay apertura pendiente (ya terminó o no arrancó).
  const settleOpenRef = useRef(null);

  // ANIMACIÓN DE APERTURA
  useEffect(() => {
    const modal = modalRef.current;
    const content = contentRef.current;
    const overlay = overlayRef?.current;

    // Normalizamos el trigger ya que este puede ser un objeto del hook useModal ({element, rect})
    // o un Ref de React estándar ({current: element})
    const element = triggerRef?.element || triggerRef?.current;
    if (!isOpen || !modal || !element) return;

    // Obtenemos el rect del trigger. Si viene precalculado en triggerRef.rect lo usamos
    // directamente para evitar un reflow innecesario.
    const rect = triggerRef.rect || element.getBoundingClientRect();

    // Etiquetamos el modal con su ID único para scoping.
    // Esto nos permite filtrar "shared elements" más adelante sin mezclar
    // elementos de distintos modales si hay varios en pantalla.
    modal.dataset.flipModalId = id;

    // Flag para cancelar la animación si el componente se desmonta antes de que
    // el requestAnimationFrame se ejecute (evita memory leaks y errores de GSAP).
    let cancelled = false;
    // Guardamos los pares shared aquí para poder restaurar la visibilidad de
    // los targets en el cleanup si la animación se cancela a mitad de camino.
    let activePairs = [];

    // Diferimos toda la lógica un frame para que React haya pintado el modal en el DOM
    // antes de que GSAP intente medirlo y animarlo.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;

      // Matamos cualquier tween activo sobre estos elementos para evitar conflictos
      // con animaciones anteriores que no hayan terminado (ej: re-apertura rápida).
      gsap.killTweensOf([modal, content, element, overlay]);

      // Activamos aceleración por GPU solo en el modal. El `content` solo hace
      // scroll, no se transforma, así que promoverlo a capa GPU es desperdicio
      gsap.set(modal, { force3D: true, willChange: "transform" });

      // Medimos el tamaño final real del modal en su estado expandido.
      // Es importante hacerlo ANTES de modificar cualquier estilo para obtener valores correctos.
      const fullWidth = modal.offsetWidth;
      const fullHeight = modal.offsetHeight;
      const modalCs = window.getComputedStyle(modal);
      const finalBg = modalCs.backgroundColor;
      // Leemos el borderRadius real del modal definido por modalStyles.js
      // (ej: rounded-[32px], rounded-none, etc.) ANTES de sobrescribirlo abajo.
      // Así respetamos el radio que cada tipo de modal configure.
      const finalBorderRadius = radiusAsFourCorners(modal);
      const triggerBorderRadius = radiusAsFourCorners(element);

      // Anulamos min-height/min-width con !important para que GSAP pueda encoger
      // el modal hasta el tamaño del botón durante la animación FLIP.
      modal.style.setProperty("min-height", "0px", "important");
      modal.style.setProperty("min-width", "0px", "important");

      // Limpiamos los estilos inline del contenido interior para que Flip pueda
      // calcular correctamente su posición y tamaño sin interferencias de runs anteriores.
      gsap.set(content, {
        clearProps: "position,top,left,width,height,boxSizing",
      });

      // Fijamos el content a su ancho final ANTES de que el FLIP anime el
      // modal. Sin esto, el content sigue el flujo del modal y su ancho
      // cambia frame a frame → el texto se re-wrappea visiblemente durante
      // la apertura. Con width fijo, el texto se layoutea una sola vez con
      // su forma final, y el overflow:hidden del modal lo recorta
      // progresivamente mientras crece.
      gsap.set(content, { width: content.offsetWidth });

      // Asignamos el mismo flipId al trigger y al modal para que GSAP los trate como
      // un par "shared element": el modal hereda la posición/forma del trigger al inicio.
      const flipId = `modal-morph-${id}`;
      element.dataset.flipId = flipId;
      modal.dataset.flipId = flipId;

      // "Shared Elements": buscamos elementos internos del trigger y del modal que
      // tengan data-flip-id para animarlos en sincronía (ej: iconos, avatares).
      // El filtro del lado del modal asegura que solo incluimos hijos del modal actual
      // y no los de otros modales que puedan estar abiertos al mismo tiempo.
      const triggerShared = Array.from(
        element.querySelectorAll("[data-flip-id]"),
      );
      const modalShared = Array.from(
        modal.querySelectorAll("[data-flip-id]"),
      ).filter((n) => {
        if (n === modal) return false;
        const closestModal = n.closest("[data-flip-modal-id]");
        return closestModal === modal;
      });

      // FLIP — paso "First": capturamos el estado actual del trigger (posición,
      // tamaño, colores, padding). borderRadius se interpola vía clip-path en
      // un tween separado (ver más abajo), no por FLIP, así que no lo
      // incluimos en props.
      const state = Flip.getState([element, ...triggerShared], {
        props: "backgroundColor,color,padding",
      });

      // Ocultamos el trigger mientras el modal está visible para que no se vea doble.
      // Desactivamos primero cualquier transition CSS (transition-opacity /
      // transition-colors de Tailwind) para que el cambio sea INSTANTÁNEO
      // y no se quede visible mientras la transition anima el opacity a 0.
      if (hideTrigger) {
        element.style.setProperty("transition", "none", "important");
        element.style.setProperty("opacity", "0", "important");
      }

      // Posición final del modal. Se recalcula igual en cada resize (ver el
      // effect de reposicionamiento más abajo), por eso vive en una función
      // aparte en vez de estar escrita acá adentro.
      const { left: finalLeft, top: finalTop } = computeModalPosition({
        location,
        growDirection,
        margin,
        fullWidth,
        fullHeight,
        triggerRect: triggerRef?.rect || rect,
      });

      // Colocamos la modal en su posición y tamaño finales.
      // Fijamos position:fixed para sacarlo del flujo normal y posicionarlo con coordenadas de viewport absolutas.
      gsap.set(modal, {
        visibility: "visible",
        opacity: 1,
        position: "fixed",
        top: finalTop,
        left: finalLeft,
        width: fullWidth,
        height: fullHeight,
        margin: 0,
        backgroundColor: window.getComputedStyle(element).backgroundColor,
        // clip-path en lugar de borderRadius: GPU-compositable, sin paint.
        clipPath: `inset(0 round ${finalBorderRadius})`,
        overflow: "hidden",
        clearProps: "transform,x,y,scale,xPercent,yPercent",
      });

      // ── SHARED ELEMENT TRANSITIONS (data-shared-id) ──
      // Buscamos pares de elementos con el mismo data-shared-id entre el trigger
      // y la modal. Para cada par creamos un clon fantasma que "vuela" visualmente
      // desde la posición del elemento en el trigger hasta su posición en la modal.
      const sharedPairs = findSharedPairs(element, modal, modal);
      const phantoms = [];
      activePairs = sharedPairs;

      for (const pair of sharedPairs) {
        const sourceRect = pair.source.getBoundingClientRect();
        const targetRect = pair.target.getBoundingClientRect();
        const fromBR = radiusAsFourCorners(pair.source);
        const toBR = radiusAsFourCorners(pair.target);
        // Font-size: animamos para que el texto crezca nativo (re-raster en
        // cada frame) en paralelo al transform: scale del phantom. Sin esto,
        // el transform escala el texto y queda borroso durante el vuelo.
        // Solo aplicable a texto (no img).
        const isImage = pair.source.tagName === "IMG";
        const fromFontSize = isImage
          ? null
          : window.getComputedStyle(pair.source).fontSize;
        const toFontSize = isImage
          ? null
          : window.getComputedStyle(pair.target).fontSize;
        // Color del texto: interpolamos del source al target para que la
        // transición de color sea gradual. Solo aplicable a texto (no img).
        const fromColor = isImage
          ? null
          : window.getComputedStyle(pair.source).color;
        const toColor = isImage
          ? null
          : window.getComputedStyle(pair.target).color;

        // Creamos el phantom posicionado sobre el elemento fuente, con la
        // forma (borderRadius) visible del source. Pasamos el target para
        // que el phantom use la font y lineHeight del destino desde el
        // inicio (si no, el texto queda 1-2px corrido durante el vuelo).
        const phantom = createPhantom(pair.source, sourceRect, pair.target);
        phantoms.push({ phantom, pair });

        // El target (elemento real dentro de la modal) se mantiene OCULTO
        // durante TODO el viaje del phantom. Usamos visibility:hidden + opacity:0
        // con !important inline para que el Flip.from(nested:true) no pueda
        // sobrescribirlo (nested anima los hijos del modal y podía restaurar la
        // visibilidad del target a mitad de animación). Solo se revela cuando
        // el deslizamiento termina (onComplete del FLIP más abajo).
        pair.target.style.setProperty("visibility", "hidden", "important");
        pair.target.style.setProperty("opacity", "0", "important");

        // Animamos el phantom desde la posición/forma/tamaño del source hasta
        // los del target. Animamos top/left/width/height (box) + borderRadius
        // + fontSize + color en paralelo para que el box crezca y el texto
        // se re-rasterice nativamente en cada frame (crisp, sin blur). Costo
        // por frame: 1 layout (box) + 1 paint (borderRadius) + 1 layout
        // (fontSize) + 1 paint (color). Usamos la MISMA duración y la MISMA
        // curva (MODAL_OPEN_EASE) que el FLIP de apertura del modal, así el
        // deslizamiento va al mismo ritmo que la apertura.
        animatePhantom(phantom, sourceRect, targetRect, fromBR, toBR, {
          duration: MODAL_OPEN_DURATION,
          ease: MODAL_OPEN_EASE,
          fromFontSize,
          toFontSize,
          fromColor,
          toColor,
        });
      }

      // El cierre de la apertura vive en una función NOMBRADA e IDEMPOTENTE
      // en vez de un onComplete anónimo. Motivo: el drag-to-close puede
      // interrumpir la apertura a mitad de vuelo, y en ese caso necesitamos
      // poder forzar este mismo cierre desde afuera (ver settleOpenRef).
      // Si esta limpieza no corre, los targets quedan visibility:hidden para
      // siempre y los phantoms quedan huérfanos volando en el body.
      let openFinalized = false;
      const finalizeOpen = () => {
        if (openFinalized || cancelled) return;
        openFinalized = true;
        // Ya no hay nada que asentar: el drag que llegue después agarra
        // un modal quieto y no necesita interrumpir nada.
        settleOpenRef.current = null;

        // Restauramos min-height/min-width que habíamos anulado para la animación
        modal.style.removeProperty("min-height");
        modal.style.removeProperty("min-width");

        // Forzamos un reflow para estabilizar el layout en fullHeight (el
        // estado durante el cual se animó el phantom). Hacemos el snap
        // ANTES de pasar a height:auto porque ese cambio puede reposicionar
        // el target dentro del modal; si midieramos después, el snap-clone
        // nacería en una posición distinta a la del phantom → brinco.
        modal.offsetHeight;

        // Mantenemos el trigger oculto mientras el modal siga abierto
        if (hideTrigger) {
          element.style.setProperty("opacity", "0", "important");
        }

        // Snap + Swap invisible: el phantom viajero es un clon del SOURCE,
        // así que aunque su caja coincida con el target, su CONTENIDO se
        // renderiza distinto (aspect-ratio, object-fit, color, peso de
        // fuente...) y un corte directo produce un brinco visible.
        //
        // Solución: en el momento del snap reemplazamos el phantom viajero
        // por un clon EXACTO del target, posicionado sobre él. Como este
        // snap-clone es idéntico al target en todo (contenido, estilos,
        // forma, tamaño), revelar el target y retirar el snap-clone es un
        // Snap invisible estilo: el phantom ya fue animado durante
        // la apertura para coincidir con el target (misma posición,
        // tamaño, borderRadius, fontSize). En lugar de montar un
        // snap-clone intermedio (que añadía frames de transición y se
        // notaba como un salto), hacemos el mismo swap instantáneo del
        // cierre: matamos el tween, revelamos el target y retiramos el
        // phantom en el mismo frame. Como el phantom y el target son
        // visualmente idénticos en ese punto, el swap es invisible.
        for (const { phantom, pair } of phantoms) {
          gsap.killTweensOf(phantom);

          // Snap-to-final: el phantom es un clon del SOURCE, así que
          // hereda sus propiedades (fontSize, fontVariationSettings,
          // fontWeight, etc.). Aunque animamos fontSize, otras como
          // fontVariationSettings (opsz en iconos) NO se animan y
          // hacen que el glyph se renderice con métricas distintas
          // al del target dentro del box → "sale más abajo".
          // Solución: copiar TODAS las propiedades visuales del target
          // al phantom justo antes del swap para que sean pixel-perfect.
          const targetStyles = window.getComputedStyle(pair.target);
          const finalRect = pair.target.getBoundingClientRect();

          const snapStyle = {
            top: finalRect.top,
            left: finalRect.left,
            width: finalRect.width,
            height: finalRect.height,
            clearProps: "transform,x,y,xPercent,yPercent",
            borderRadius: radiusAsFourCorners(pair.target),
            fontSize: targetStyles.fontSize,
            fontVariationSettings: targetStyles.fontVariationSettings,
            fontWeight: targetStyles.fontWeight,
            fontFamily: targetStyles.fontFamily,
            letterSpacing: targetStyles.letterSpacing,
            textTransform: targetStyles.textTransform,
            color: targetStyles.color,
            backgroundColor: targetStyles.backgroundColor,
            backgroundImage: targetStyles.backgroundImage,
            boxShadow: targetStyles.boxShadow,
            filter: targetStyles.filter,
            opacity: targetStyles.opacity,
            overflow: targetStyles.overflow,
          };
          gsap.set(phantom, snapStyle);

          // Desactivamos transiciones CSS del target para un reveal
          // instantáneo (sin que transition-opacity lo anime lentamente).
          const prevTransition = pair.target.style.transition;
          pair.target.style.transition = "none";

          // Revelamos el target real instantáneamente.
          // Quitamos los !important de visibility/opacity que fijamos al
          // inicio para que el target vuelva a ser visible.
          pair.target.style.removeProperty("visibility");
          pair.target.style.removeProperty("opacity");
          gsap.set(pair.target, { opacity: 1, clearProps: "opacity" });

          // Retiramos el phantom en el mismo frame.
          phantom.remove();

          // Restauramos las transiciones CSS del target en el próximo frame.
          requestAnimationFrame(() => {
            if (pair.target) pair.target.style.transition = prevTransition;
          });
        }

        // Tras el snap (ya con el target revelado y el phantom retirado),
        // liberamos el modal a su altura natural y activamos el scroll
        // en el content (children), NO en el modal. El header con el
        // botón de cerrar debe quedar fijo arriba sin scrollear, así que
        // el overflow vive en el div de children que tiene flex-1.
        // Liberamos el width fijo que usamos para prevenir reflow del
        // texto durante la animación. El content vuelve a su flow normal.

        gsap.set(content, { overflowY: "auto" });

        // Devolvemos el tamaño al CSS, pero SOLO si el modal pidió ser
        // responsive. Durante el FLIP el modal necesita width/height en
        // píxeles (es lo que se anima); si se los dejamos puestos queda
        // clavado en el tamaño que tenía la ventana al abrir, las media
        // queries de Tailwind dejan de tener efecto y un resize no cambia
        // nada. Al limpiarlos vuelve a medir lo que digan sus clases
        // (w-screen, w-100/md:w-125…) y se adapta solo.
        //
        // El mismo criterio para el width fijo del content, que existe para
        // que el texto no se re-wrapee frame a frame durante la apertura.
        //
        // Cuando responsive es false dejamos todo pinneado a propósito: es
        // el camino barato, sin listeners ni relayouts mientras esté abierto.
        if (responsive) {
          gsap.set(content, { clearProps: "width" });
          gsap.set(modal, { clearProps: "width,height" });
        }

        gsap.set(modal, {
          willChange: "auto",
          clearProps: "backgroundColor,color,padding",
        });
      };

      const tl = gsap.timeline();

      // Aqui comparamos el estado guardado (trigger)
      // contra el estado actual (modal expandido) y animamos la transición entre ambos.
      // nested:true permite que los shared elements internos también se animen correctamente.
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: MODAL_OPEN_DURATION,
          ease: MODAL_OPEN_EASE,
          props: "color,padding",
          onComplete: finalizeOpen,
        }),
      );

      tl.fromTo(
        modal,
        { backgroundColor: window.getComputedStyle(element).backgroundColor },
        { backgroundColor: finalBg, duration: 0.2, ease: "power1.out" },
        0,
      );

      // Transición explícita del borderRadius desde el del trigger hasta el
      // final de la modal. La sacamos de los props del FLIP para poder
      // ajustarla independientemente y mantener consistencia con el cierre,
      // que también la anima con un tween propio.
      //
      // Duración matcheada con MODAL_OPEN_DURATION (no 0.3s) para que el
      // radio siga settleando mientras el modal ya está a tamaño completo:
      // MODAL_OPEN_EASE alcanza ~85% del tamaño a t=0.18s, así que si el
      // radio termina a 0.3s se pierde la ventana visible del settlement.
      // Con la duración completa, el radio se termina de asentar durante
      // los últimos frames del FLIP — justo cuando el modal ya está grande
      // y se puede apreciar cómo la esquina se abre.
      //
      // power2.out (arranca rápido, desacelera al final) en vez de sine.in:
      // así el radio empieza a moverse durante el crecimiento (visible
      // mientras la caja crece) y desacelera suavemente hacia el radio
      // final, en lugar de quedarse pegado al del trigger y saltar al final.
      // clip-path con round() en vez de borderRadius: GPU-compositable.
      tl.fromTo(
        modal,
        { clipPath: `inset(0 round ${triggerBorderRadius})` },
        {
          clipPath: `inset(0 round ${finalBorderRadius})`,
        },
        0,
      );

      // Oscurecemos el overlay de fondo en paralelo con la apertura del modal
      if (overlay) {
        tl.to(
          overlay,
          { backgroundColor: "rgba(0,0,0,0.08)", duration: 0.15 },
          0,
        );
      }

      // Publicamos la forma de "terminar la apertura YA" para que el drag
      // pueda llamarla antes de tomar el control del modal. progress(1)
      // deja el FLIP en su estado final (modal a tamaño completo, sin
      // transform residual) y finalizeOpen hace el swap de los phantoms.
      // Llamamos a finalizeOpen explícitamente en vez de confiar en que
      // progress(1) dispare el onComplete: el seek de GSAP puede suprimir
      // callbacks, y esta limpieza NO es opcional. Como es idempotente,
      // que corra dos veces no cuesta nada.
      settleOpenRef.current = () => {
        tl.progress(1);
        finalizeOpen();
        settleOpenRef.current = null;
      };
    });

    // Aqui limpiamos la modal si el componente se desmonta o si isOpen cambia
    // antes de que el frame se ejecute. Garantiza que el trigger quede visible.
    return () => {
      cancelled = true;
      settleOpenRef.current = null;
      cancelAnimationFrame(raf);
      // Limpiamos cualquier phantom que haya quedado huérfano
      document
        .querySelectorAll(".shared-element-phantom")
        .forEach((p) => p.remove());
      if (element) {
        if (hideTrigger) {
          element.style.removeProperty("opacity");
          element.style.removeProperty("transition");
          gsap.set(element, {
            opacity: 1,
            clearProps: "opacity,transition",
          });
        }
      }
      // Restauramos la visibilidad de los targets por si la animación se
      // canceló antes de que el phantom llegara.
      for (const pair of activePairs) {
        if (pair.target) {
          pair.target.style.removeProperty("visibility");
          pair.target.style.removeProperty("opacity");
        }
      }
    };
  }, [
    isOpen,
    triggerRef,
    location,
    modalRef,
    contentRef,
    overlayRef,
    id,
    growDirection,
    margin,
    hideTrigger,
    responsive,
  ]);

  // ANIMACIÓN DE CIERRE
  // Se envuelve en useCallback para mantener referencia estable entre renders.
  const closeModal = useCallback(
    (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const element = triggerRef?.element || triggerRef?.current;
      const modal = modalRef.current;
      const content = contentRef.current;
      const overlay = overlayRef?.current;

      // Si faltan referencias, cerramos directamente sin animación para no romper el UI
      if (!element || !modal || !content) {
        onClose();
        return;
      }

      // Si ya hay una animación de cierre en curso, ignoramos el click
      if (modal.dataset.closing === "true") return;
      modal.dataset.closing = "true";

      // Matamos tweens activos para evitar conflictos si el usuario cierra durante una apertura
      gsap.killTweensOf([modal, content, overlay, element]);

      // Solo se desvanece el shared element DENTRO del trigger (texto/icono)
      // para que el phantom del modal vuele de vuelta y se "fusione" con el
      // botón sin que se vea el contenido del trigger por debajo.
      // Si el trigger estaba oculto (hideTrigger:true), lo mostramos con un
      // fade suave para que no aparezca de golpe. Lo delay-eamos para que
      // el trigger EMPIECE a aparecer cuando la modal ya está llegando a su
      // destino (no desde el inicio del cierre) — así se siente como un
      // único movimiento de "la modal se encoge y el botón aparece", no
      // como dos cosas compitiendo.
      if (hideTrigger) {
        gsap.to(element, {
          opacity: 1,
          duration: 0.23,
          ease: "power2.out",
          delay: 0.12,
        });
      }

      // Ocultamos overflow para que el contenido del modal no se desborde
      gsap.set(modal, { overflow: "hidden" });

      // FIjamos la altura en px antes de sacar el content del flujo.
      const modalCurrentRect = modal.getBoundingClientRect();
      gsap.set(modal, { height: modalCurrentRect.height });

      // Ocultamos overflow para que el contenido del modal no se desborde al encoger
      gsap.set(modal, { overflow: "hidden" });

      // Reasignamos el mismo flipId al trigger y al modal para el viaje de vuelta
      const flipId = `modal-morph-${id}`;
      element.setAttribute("data-flip-id", flipId);
      modal.setAttribute("data-flip-id", flipId);

      // Shared elements del modal
      const modalShared = Array.from(
        modal.querySelectorAll("[data-flip-id]"),
      ).filter((n) => {
        if (n === modal) return false;
        const closestModal = n.closest("[data-flip-modal-id]");
        return closestModal === modal;
      });

      // ── SHARED ELEMENT TRANSITIONS (cierre) ──
      // Buscamos pares de data-shared-id entre la modal y el trigger para
      // animar los phantoms de vuelta a su posición original.
      const sharedPairs = findSharedPairs(element, modal, modal);
      const closePhantoms = [];

      for (const pair of sharedPairs) {
        // Si el usuario cerró antes de que terminara la apertura, el target
        // pudo quedar con visibility:hidden !important inline. Lo removemos
        // ANTES de clonar para que el phantom no herede esa invisibilidad.
        pair.target.style.removeProperty("visibility");
        pair.target.style.removeProperty("opacity");

        const targetRect = pair.target.getBoundingClientRect();

        // Creamos el phantom posicionado sobre el elemento en la modal, con la
        // forma (borderRadius) visible del target. Pasamos el source (que es
        // el "destino" del cierre) para que el phantom use la font y
        // lineHeight del botón desde el inicio del viaje de vuelta.
        const phantom = createPhantom(pair.target, targetRect, pair.source);
        const fromBR = radiusAsFourCorners(pair.target);
        const isImage = pair.target.tagName === "IMG";
        const fromFontSize = isImage
          ? null
          : window.getComputedStyle(pair.target).fontSize;
        const fromColor = isImage
          ? null
          : window.getComputedStyle(pair.target).color;
        closePhantoms.push({ phantom, pair, fromBR, fromFontSize, fromColor });

        // Magia del shared element: ocultamos el target visualmente pero
        // SIN sacarlo del flow (display:none causa layout shift — los
        // hermanos se reubican donde estaba el target y se ve raro).
        // Usamos clip-path:inset(100%) para clippearlo a nada sin tocar
        // el layout, más visibility:hidden como red de seguridad por si
        // Flip.from(nested:true) resetea el clip durante la animación.
        // visibility:hidden + opacity:0 solos no alcanzan — FLIP restaura
        // los estilos inline del target a mitad de animación.
        pair.target.style.clipPath = "inset(100%)";
        pair.target.style.visibility = "hidden";

        // Ocultamos el shared element DENTRO del trigger con un fade suave.
        // El botón (trigger) permanece visible — solo se desvanece el
        // texto/icono que va a ser "reemplazado" por el phantom del modal
        // durante el vuelo el contenedor nunca se va.
        gsap.to(pair.source, { opacity: 0, duration: 0.15, ease: "power2.in" });
      }

      // Desvanecemos el contenido de la modal al inicio del cierre para que
      // solo se vea el phantom volando de vuelta al trigger nítido. Sin
      // esto, el content (position:absolute con dimensiones fijas) se
      // recorta por el overflow:hidden de la modal mientras se encoge con
      // FLIP → el texto se ve "rodando" durante la animación.
      const fadeTargets = collectFadeTargets(content);
      gsap.set(fadeTargets, { willChange: "opacity, transform" });

      // Aqui capturamos los estilos actuales del modal abierto.
      const state = Flip.getState([modal, ...modalShared], {
        props: "backgroundColor,color,padding",
      });

      // Prevención extra por si element fue liberado entre líneas
      if (!element) return;

      // En el cierre SIEMPRE remedimos el trigger — no usamos el rect
      // cacheado en triggerRef.rect (que useModal capturó cuando se abrió
      // la modal). Ese cache queda stale si entre abrir y cerrar cambió el
      // viewport (resize, toggle de responsive en devtools, scroll, layout
      // shift). Usarlo hacía que la modal terminara en coordenadas viejas
      // (ej: donde estaba el botón en desktop) y el content aparecía
      // "flotando" en un lugar random del viewport en mobile. Los phantoms
      // ya usaban getBoundingClientRect fresco, así que iban bien —
      // solo la modal quedaba desalineada respecto a ellos.
      //
      // Fallback al rect cacheado solo si el fresh devuelve tamaño 0
      // (trigger fue removido del DOM antes de que termine la animación).
      const freshTriggerRect = element.getBoundingClientRect();
      const triggerRect =
        freshTriggerRect.width && freshTriggerRect.height
          ? freshTriggerRect
          : triggerRef.rect || freshTriggerRect;
      const triggerStyles = window.getComputedStyle(element);

      // Limpiamos transforms residuales de la apertura para que Flip calcule bien la ubicación
      gsap.set(modal, { clearProps: "transform,x,y,scale,xPercent,yPercent" });

      // Volvemos a anular min-height/min-width para que GSAP pueda encoger el modal
      // hasta el tamaño exacto del botón durante la animación de cierre.
      modal.style.setProperty("min-height", "0px", "important");
      modal.style.setProperty("min-width", "0px", "important");

      // Aqui movemos el modal al tamaño y posición del trigger.
      // Copiamos sus colores y padding para que la transición de color sea suave.
      gsap.set(modal, {
        position: "fixed",
        top: triggerRect.top,
        left: triggerRect.left,
        width: triggerRect.width,
        height: triggerRect.height,
        padding: triggerStyles.padding,
        color: triggerStyles.color,
        overflow: "hidden",
        margin: 0,
      });

      // Reactivamos aceleración GPU solo en el modal para la animación de cierre.
      gsap.set(modal, { force3D: true, willChange: "transform" });

      // Ahora que calculamos las posiciones finales del trigger, animamos los phantoms de vuelta.
      // Animamos top/left/width/height (box) + borderRadius + fontSize + color
      // en paralelo para que el box se encoja y el texto se re-rasterice
      // nativamente en cada frame (crisp, sin blur).
      for (const {
        phantom,
        pair,
        fromBR,
        fromFontSize,
        fromColor,
      } of closePhantoms) {
        const currentRect = {
          top: parseFloat(phantom.style.top),
          left: parseFloat(phantom.style.left),
          width: parseFloat(phantom.style.width),
          height: parseFloat(phantom.style.height),
        };
        const sourceRect = pair.source.getBoundingClientRect();
        const toBR = radiusAsFourCorners(pair.source);
        const isImage = pair.source.tagName === "IMG";
        const toFontSize = isImage
          ? null
          : window.getComputedStyle(pair.source).fontSize;
        const toColor = isImage
          ? null
          : window.getComputedStyle(pair.source).color;

        // Misma duración y misma curva (power2.inOut) que el FLIP de cierre.
        // power2.inOut es más natural que sine.inOut (sine se siente
        // "flotando" al final) y menos agresivo que power4 — el sweet spot.
        animatePhantom(phantom, currentRect, sourceRect, fromBR, toBR, {
          duration: 0.3,
          ease: "power2.inOut",
          fromFontSize,
          toFontSize,
          fromColor,
          toColor,
        });
      }

      // Función de limpieza que se llama al terminar la animación.
      // Elimina los overrides de min-height, restaura el trigger y llama a onClose
      // para que React desmonte el modal del DOM.
      function cleanup() {
        delete modal.dataset.closing;
        modal.style.removeProperty("min-height");
        modal.style.removeProperty("min-width");
        // Limpiamos los inline de width/height/top/left/position que el
        // FLIP y el gsap.set de cierre dejaron en el modal. Si los
        // dejamos, el modal queda "pegado" al tamaño/posición del
        // trigger, y cuando React re-renderiza con isOpen=false el
        // style attribute (visibility:hidden) no alcanza a entrar
        // antes del siguiente paint → el modal "reabre" con el tamaño
        // del trigger (que al final del FLIP es casi el del modal) y
        // se ve el flash. Mantenemos opacity:0 inline para que siga
        // invisible durante el re-render.
        modal.style.removeProperty("width");
        modal.style.removeProperty("height");
        modal.style.removeProperty("top");
        modal.style.removeProperty("left");
        modal.style.removeProperty("position");
        // Mantenemos el modal invisible hasta que React lo desmonte.
        // Sin esto, hay un frame donde el modal (sin position:fixed ni
        // dimensions inline) se renderiza en su posición natural (top-left)
        // antes de que onClose() lo retire del DOM → flash visible.
        //
        // display:none en vez de visibility:hidden: al remover position:fixed
        // arriba, el modal deja de ser contexto de posicionamiento, y
        // cualquier hijo con position:absolute cae al initial containing
        // block (viewport) y se pinta arriba a la izquierda durante el
        // frame entre cleanup y el unmount de React.
        // visibility:hidden no lo tapaba porque un descendiente puede
        // sobreescribirla con visibility:visible (clase Tailwind, estilo
        // inline, reset). display:none no se puede sobreescribir desde
        // los hijos — nada del subtree renderiza, nada se escapa al viewport.
        modal.style.setProperty("display", "none", "important");
        gsap.set(modal, { willChange: "auto" });
        // Restauramos la visibilidad del content que desvanecimos durante
        // el viaje de los phantoms de cierre. Reusamos la misma lista
        // (fadeTargets) que animamos para no volver a hacer un walk de "*".
        content.style.removeProperty("visibility");
        for (const el of fadeTargets) {
          gsap.set(el, {
            clearProps: "opacity,transform,scale,willChange",
          });
        }
        // Restauramos clip-path y visibility de los targets que clippeamos
        // para la "magia" del shared element — si no, al re-abrir la modal
        // siguiente el span con data-shared-id arrancaría invisible.
        for (const { pair } of closePhantoms) {
          pair.target.style.removeProperty("clip-path");
          pair.target.style.removeProperty("visibility");
        }
        // Snap invisible: el phantom ya fue animado durante el
        // cierre para coincidir con el shared element del trigger (misma
        // posición, tamaño, borderRadius, fontSize). En lugar de hacer un
        // crossfade (que se nota como un fade), hacemos un swap instantáneo:
        // matamos el tween del phantom, revelamos el shared element del
        // trigger y retiramos el phantom en el mismo frame. Como el phantom
        // y el original son visualmente idénticos en ese punto, el swap es
        // invisible — no se nota la transición.
        for (const { phantom, pair } of closePhantoms) {
          gsap.killTweensOf(phantom);

          // Snap-to-final: el phantom es un clon del TARGET (modal), así
          // que tiene sus propiedades (fontVariationSettings, fontWeight,
          // color, etc.). Aunque animamos fontSize y borderRadius, otras
          // propiedades (opsz en iconos, color, boxShadow…) NO se animan
          // y hacen que el glyph se renderice con métricas distintas al
          // del source dentro del box → "se ve un salto" al hacer el swap.
          // Forzamos TODAS las propiedades visuales del source al phantom
          // para que el swap sea pixel-perfect e invisible.
          const sourceStyles = window.getComputedStyle(pair.source);
          const sourceRect = pair.source.getBoundingClientRect();
          gsap.set(phantom, {
            top: sourceRect.top,
            left: sourceRect.left,
            width: sourceRect.width,
            height: sourceRect.height,
            // Limpiamos transform + willChange para que el phantom salga
            // de su capa GPU (creada por animatePhantom con force3D y
            // willChange) y comparta el contexto de compositing del
            // source. Si no, al retirar el phantom su capa desaparece
            // y el source (sin willChange) se re-composita → flicker.
            clearProps: "transform,x,y,xPercent,yPercent,willChange",
            // Forzamos force3D:false para que gsap no re-promueva el
            // phantom a una capa 3D al aplicar el set (haría que el
            // phantom volviera a tener translateZ(0) y se creara una
            // nueva capa GPU que no existe en el source).
            force3D: false,
            borderRadius: radiusAsFourCorners(pair.source),
            fontSize: sourceStyles.fontSize,
            fontVariationSettings: sourceStyles.fontVariationSettings,
            fontWeight: sourceStyles.fontWeight,
            fontFamily: sourceStyles.fontFamily,
            letterSpacing: sourceStyles.letterSpacing,
            textTransform: sourceStyles.textTransform,
            color: sourceStyles.color,
            backgroundColor: sourceStyles.backgroundColor,
            backgroundImage: sourceStyles.backgroundImage,
            boxShadow: sourceStyles.boxShadow,
            filter: sourceStyles.filter,
            opacity: sourceStyles.opacity,
            overflow: sourceStyles.overflow,
          });

          // Swap estilo: el source se revela INSTANTÁNEAMENTE a opacity 1
          // (con transition:none para que sea atómico), y lo que el usuario ve
          // es el phantom DESVANEICIÉNDOSE lentamente para dejar ver el source
          // que ya estaba ahí. El source no "aparece" — el phantom simplemente
          // se va y revela lo que ya estaba debajo. Esto evita el brinco de
          // paint que causaba el gsap.fromTo con fade-in: el source estaba
          // al ~9% de opacity cuando retirábamos el phantom, y el usuario
          // veía un salto de "phantom visible" a "source casi invisible".
          // Con el source ya a opacity 1, solo se desvanece el phantom —
          // un único cambio visual continuo.
          const prevTransition = pair.source.style.transition;
          pair.source.style.transition = "none";

          pair.source.style.removeProperty("opacity");
          gsap.set(pair.source, { opacity: 1, clearProps: "opacity" });

          // Swap instantáneo: el snap-to-final de arriba dejó el phantom
          // pixel-perfect sobre el source (misma posición, tamaño,
          // borderRadius, fontSize, color, bg, etc.), así que quitarlo
          // y revelar el source es atómico — sin el fade de 0.18s el
          // usuario ve el phantom un frame y el source al siguiente,
          // sin la transición perceptible que se notaba como un "brinco".
          phantom.remove();

          requestAnimationFrame(() => {
            if (pair.source) pair.source.style.transition = prevTransition;
          });
        }
        onClose();
      }

      // Timeline del cierre. onInterrupt garantiza que se aplique la funcion cleanup aunque el usuario
      // interrumpa la animación antes de que termine
      const tl = gsap.timeline({ onComplete: cleanup, onInterrupt: cleanup });

      // Desvanecemos el overlay en paralelo con el cierre del modal
      if (overlay) {
        tl.to(
          overlay,
          {
            backgroundColor: "rgba(0,0,0,0)",
            duration: 0.28,
            ease: "power1.inOut",
          },
          0,
        );
      }

      // Aqui animamos la modal desde su estado grande o abierto capturandolo con state
      // hasta el estado del trigger. power2.inOut — sweet spot entre
      // sine.inOut (se siente flotando al final) y power4 (muy agresivo).
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: 0.3,
          ease: "power2.inOut",
          props: "backgroundColor,color,padding",
        }),
        0,
      );

      // Fade + scale sutil que reemplaza al blur original. El scale a 0.94
      // simula el "colapso hacia la modal" que antes daba la sensación de
      // difuminado. Arranca inmediato (t=0) para que el contenido empiece a
      // desvanecerse a la par que el FLIP encoge la modal, y termina antes
      // de que la modal llegue al trigger para que no haya contenido visible
      // al tamaño del botón. Ambas propiedades son composite-only.
      tl.to(
        fadeTargets,
        {
          opacity: 0,
          scale: 0.94,
          duration: 0.22,
          ease: "power2.out",
        },
        0,
      );

      // Ajustamos el borderRadius gradualmente para que al final coincida con el del trigger.
      // clip-path en vez de borderRadius: GPU-compositable, sin paint.
      tl.to(
        modal,
        {
          clipPath: `inset(0 round ${triggerStyles.borderRadius})`,
          duration: 0.26,
          ease: "power2.inOut",
        },
        0.04,
      );

      // El modal hace fade out para que cuando llegue al tamaño del
      // trigger (al final del FLIP, t=0.3s) ya sea totalmente invisible.
      // Antes el fade arrancaba a 0.24s con duration 0.05s (terminaba a
      // 0.29s), pero a 0.29s el FLIP ya estaba al ~97% del tamaño del
      // trigger y el modal aún tenía opacidad > 0 → se veía "salir" con
      // el tamaño del trigger antes de que el FLIP terminara. Ahora el
      // fade arranca a 0.12s y termina a 0.22s: el modal es invisible
      // durante el último ~25% del FLIP, así nunca se ve al tamaño del
      // trigger con opacidad visible.
      tl.to(modal, { opacity: 0, duration: 0.1, ease: "power2.in" }, 0.12);
    },
    [onClose, triggerRef, modalRef, contentRef, overlayRef, id, hideTrigger],
  );

  // ─── EXPOSICIÓN DE closeModal EN EL DOM ───────────────────────────
  //
  // Adherimos la función closeModal (que dispara el cierre animado FLIP)
  // como propiedad no-enumerable del elemento DOM del modal. Esto le
  // permite a otros hooks (típicamente useInnerModal) disparar el cierre
  // animado sin necesidad de tener acceso al hook — encuentran el modal
  // en el DOM por [data-flip-modal-id] y llaman a modal.__flipCloseModal.
  //
  // POR QUÉ ADHERIR AL DOM Y NO A UN CONTEXT/REGISTRO:
  //   - El modal se rendera vía createPortal a #modal-root y no comparte
  //     árbol React con el hook que quiere cerrarlo. Un Context requeriría
  //     un Provider que envuelva ambos, que en la práctica no existe.
  //   - Un registro global (Map) funcionaría pero necesita coordinación
  //     de keys entre productor (useFlipModal) y consumidor (useInnerModal).
  //     Adherir al DOM es más directo y se limpia solo cuando el nodo
  //     se desmonta (el garbage collector se lleva la referencia).
  //
  // Se limpia en el cleanup del effect: si closeModal cambió de identidad
  // (deps del useCallback cambiaron), retiramos la propiedad vieja antes
  // de la nueva. Guardamos solo si la propiedad actual es la que pusimos
  // nosotros para no pisar a otra instancia si hay races raras.
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;
    modal.__flipCloseModal = closeModal;
    return () => {
      if (modal.__flipCloseModal === closeModal) {
        delete modal.__flipCloseModal;
      }
    };
  }, [isOpen, closeModal, modalRef]);

  // ─── REPOSICIONAMIENTO EN RESIZE ──────────────────────────────────
  //
  // El modal se posiciona con position:fixed + top/left en píxeles, que es
  // lo que necesita el FLIP para animar desde el rect del trigger. El
  // problema es que esos píxeles se calculan UNA vez, al abrir: si después
  // cambia el tamaño de la ventana, el modal se queda donde estaba y el
  // clamping contra los bordes deja de valer (puede terminar cortado o
  // fuera de pantalla).
  //
  // Acá recalculamos la posición con la misma función que usa la apertura.
  // El tamaño NO se recalcula a mano: finalizeOpen limpia width/height para
  // que lo maneje el CSS, así que basta con leer cuánto mide ahora.
  //
  // Nos colgamos de requestAnimationFrame en vez de escuchar resize a pelo
  // porque el evento se dispara decenas de veces mientras se arrastra el
  // borde de la ventana, y cada pasada hace lectura de layout. Con el rAF
  // colapsamos todas las que caen en el mismo frame en una sola.
  useEffect(() => {
    // Opt-in: sin responsive no montamos el listener. Un modal no-responsive
    // no paga NADA por esta feature — ni el handler ni las lecturas de layout.
    if (!responsive) return;
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    let raf = null;

    const reposition = () => {
      raf = null;
      // Si la apertura todavía está en vuelo, no tocamos nada: el FLIP está
      // animando top/left en este preciso instante y pisarlo produce un
      // salto. Al terminar, el modal ya queda con la geometría correcta.
      if (settleOpenRef.current) return;

      const element = triggerRef?.element || triggerRef?.current;
      const { left, top } = computeModalPosition({
        location,
        growDirection,
        margin,
        fullWidth: modal.offsetWidth,
        fullHeight: modal.offsetHeight,
        // Releemos el rect del trigger en vivo: sigue en el DOM (solo está
        // en opacity 0) y su posición también cambió con el resize. Usar el
        // rect cacheado del open volvería a anclar el modal a un lugar viejo.
        triggerRect: element ? element.getBoundingClientRect() : null,
      });

      gsap.set(modal, { top, left });
    };

    const onResize = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(reposition);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [
    responsive,
    isOpen,
    modalRef,
    triggerRef,
    location,
    growDirection,
    margin,
  ]);

  // El drag-para-cerrar vive en su propio hook. Le pasamos closeModal
  // como handler: cuando el usuario supera el umbral de distancia o
  // velocidad, dispara exactamente el mismo cierre animado que la X.
  // El drag llama a esto ANTES de tomar control del modal. Si la apertura
  // sigue en vuelo, la termina de golpe; si ya terminó, no hace nada.
  // Estable de por vida (solo lee una ref), así el effect del drag no se
  // re-monta por su culpa.
  const settleOpen = useCallback(() => {
    settleOpenRef.current?.();
  }, []);

  useDragModal({
    isOpen,
    modalRef,
    onDragClose: closeModal,
    onDragStart: settleOpen,
    dragToClose,
  });

  return { closeModal };
};
