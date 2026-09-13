import { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";
import { useDragModal } from "@hooks/useDragModal";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Flip, CustomEase);
}

// Una sola curva gobierna todo el morph, apertura y cierre. Los dos
// segmentos comparten tangente en la unión, así que no hay quiebre al
// pasar del primero al segundo, y el control 2 final en (0.656, 1) deja
// la tangente horizontal: el aterrizaje no rebota ni se corta.
const MODAL_MORPH_EASE = "modalMorph";
const MODAL_OPEN_EASE = MODAL_MORPH_EASE;
const MODAL_OPEN_DURATION = 0.7;
// El cierre es notoriamente más corto que la apertura. Abrir es una
// invitación y se puede tomar su tiempo; cerrar es una respuesta a algo que
// el usuario ya decidió, y cada centésima de más se siente como que la
// interfaz no lo suelta. La curva es la misma: lo único que cambia es
// cuánto dura.
const MODAL_CLOSE_DURATION = 0.45;

// El cierre reparte el trabajo en dos curvas distintas: la forma se
// redondea antes que el desenfoque, así el contenido ya perdió sus
// bordes cuando empieza a disolverse.
const MODAL_CLOSE_SHAPE_EASE = "modalCloseShape";
const MODAL_CLOSE_BLUR_EASE = "modalCloseBlur";

// El color del phantom NO viaja con la curva del morph. Esa curva se toma su
// tiempo a proposito — es la caja recorriendo media pantalla — y arrastrar el
// color con ella deja al elemento vestido de su origen casi todo el vuelo,
// para recien virar sobre el final. Se lee como un parpadeo tardio, no como
// una transicion. El color resuelve la IDENTIDAD del elemento, y eso tiene
// que quedar decidido temprano; despues la geometria sigue viajando sola. Es
// el mismo reparto que ya usa el fondo de la propia modal contra su FLIP.
const PHANTOM_COLOR_RATIO = 0.25;
const PHANTOM_COLOR_EASE = "power2.out";

// El contenido entra con desenfoque proporcional a su tamaño y se va con
// uno mucho mayor: un modal es una superficie completa, no una fila.
const CONTENT_OPEN_BLUR = 8;
const CONTENT_CLOSE_BLUR = 32;

// El content encoge cuatro veces más lento que la caja, así que al terminar
// el cierre recorrió apenas un cuarto del camino. Es deliberado: lo que se
// ve es una caja cerrándose encima del contenido, no el contenido siendo
// absorbido por el botón. Se deriva de la duración del cierre para que la
// proporción sobreviva a cualquier ajuste de velocidad.
const CONTENT_CLOSE_DRIFT_DURATION = MODAL_CLOSE_DURATION * 4;

// El fondo se apaga con la misma duración que la caja, pero con power3.in:
// sigue en pantalla mientras la caja ya está llegando al trigger.
const OVERLAY_COLOR = "rgba(0,0,0,0.1)";
const OVERLAY_OPEN_DURATION = 0.5;

// El trigger reaparece recién cuando la caja ya casi llegó, para que se
// lea como un único movimiento y no como dos cosas compitiendo. Las dos
// salen de la duración del cierre — arranca al 40% y termina en el mismo
// frame que la caja — o al acortar el cierre el botón quedaría apareciendo
// después de que la modal ya no está.
// El disparador termina de aparecer ANTES de que el cierre acabe, no junto
// con el. Terminar en el mismo frame que la caja dejaba una carrera: el
// cleanup le pone display:none a la modal y el boton todavia venia en 0.9 de
// opacidad, asi que el ultimo tramo del fade quedaba a la intemperie y se
// leia como un pop. Cerrando en el 85% el boton ya esta asentado mientras la
// caja — que a esa altura tiene su mismo tamano y su mismo color — todavia lo
// tapa, y lo unico que pasa al final es que la caja desaparece.
const TRIGGER_RESTORE_DELAY = MODAL_CLOSE_DURATION * 0.45;
const TRIGGER_RESTORE_DURATION = MODAL_CLOSE_DURATION * 0.4;

if (typeof window !== "undefined") {
  CustomEase.create(
    MODAL_MORPH_EASE,
    "M0,0 C0.308,0.19 0.107,0.633 0.288,0.866 0.382,0.987 0.656,1 1,1",
  );
  CustomEase.create(MODAL_CLOSE_SHAPE_EASE, ".56,.27,0,1");
  CustomEase.create(MODAL_CLOSE_BLUR_EASE, ".37,.35,0,1");
}

// Curva spring de 21 tramos para el tinte del overlay: se dispara al 56%
// en el 20% del recorrido y después se asienta. Se recorre a mano porque
// GSAP no interpola un linear() de CSS.
const OVERLAY_TINT_STOPS = [
  [0, 0],
  [0.025, 0.017],
  [0.05, 0.037],
  [0.075, 0.061],
  [0.1, 0.091],
  [0.125, 0.13],
  [0.15, 0.184],
  [0.175, 0.275],
  [0.2, 0.562],
  [0.225, 0.733],
  [0.25, 0.803],
  [0.275, 0.848],
  [0.3, 0.88],
  [0.325, 0.902],
  [0.4, 0.942],
  [0.5, 0.97],
  [0.6, 0.985],
  [0.7, 0.993],
  [0.8, 0.998],
  [0.9, 1],
  [1, 1],
];

function overlayTintEase(progress) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  let index = 0;
  while (
    index < OVERLAY_TINT_STOPS.length - 2 &&
    OVERLAY_TINT_STOPS[index + 1][0] < progress
  ) {
    index++;
  }

  const [fromProgress, fromValue] = OVERLAY_TINT_STOPS[index];
  const [toProgress, toValue] = OVERLAY_TINT_STOPS[index + 1];

  return (
    fromValue +
    ((progress - fromProgress) / (toProgress - fromProgress)) *
      (toValue - fromValue)
  );
}

// Tailwind v4 emite toda su paleta en oklch() y GSAP no sabe parsearlo:
// interpola hacia un gris translúcido y el morph se tiñe de un color que
// no está en ninguna de las dos puntas — un verde saliendo hacia blanco
// pasaba por gris con alpha 0.44.
//
// No alcanza con asignar el color a fillStyle y leerlo de vuelta: Chrome
// soporta CSS Color 4 en canvas y devuelve el oklch() intacto. Hay que
// pintar el pixel y leerlo, que es lo que fuerza la conversión a sRGB.
const colorProbe =
  typeof document !== "undefined"
    ? (() => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        return canvas.getContext("2d", { willReadFrequently: true });
      })()
    : null;

function toGsapColor(color) {
  if (!colorProbe || !color || color.startsWith("rgb") || color.startsWith("#"))
    return color;

  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = "#000000";
  colorProbe.fillStyle = color;
  colorProbe.fillRect(0, 0, 1, 1);

  const [red, green, blue, alpha] = colorProbe.getImageData(0, 0, 1, 1).data;

  return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
}

/**
 * Devuelve un box-shadow de destino que GSAP pueda interpolar contra `from`.
 *
 * La sombra no se puede tweenear hacia `none`: GSAP interpola string contra
 * string emparejando numeros posicion por posicion, y "none" no tiene ninguno,
 * asi que la sombra no se va apagando — se corta de un frame al otro. Cuando
 * el destino no tiene sombra devolvemos una con la MISMA cantidad de capas que
 * la de origen pero en cero y transparente: misma forma, valores nulos, y el
 * apagado se interpola como cualquier otra cosa.
 */
function matchedShadow(from, to) {
  if (to && to !== "none") return to;
  if (!from || from === "none") return "none";

  return from
    .split(/,(?![^(]*\))/)
    .map(() => "rgba(0, 0, 0, 0) 0px 0px 0px 0px")
    .join(", ");
}

/**
 * Fija en inline los colores ya normalizados a rgb para que todo lo que
 * lea el morph (Flip, tweens explícitos, phantoms) trabaje sobre valores
 * parseables. Se limpian al terminar la animación.
 */
function pinReadableColors(elements) {
  for (const element of elements) {
    if (!element) continue;

    const styles = window.getComputedStyle(element);
    element.style.backgroundColor = toGsapColor(styles.backgroundColor);
    element.style.color = toGsapColor(styles.color);
  }
}

function releaseReadableColors(elements) {
  for (const element of elements) {
    if (!element) continue;

    element.style.removeProperty("background-color");
    element.style.removeProperty("color");
  }
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
/**
 * El fontSize de la raíz del phantom NO alcanza a los descendientes que traen
 * tipografía propia: `Icon` escribe su `font-size` y su eje `opsz` inline, así
 * que el clon de una insignia de 26px se quedaba con un glifo de 26px dentro
 * de una caja que ya medía la del destino (80px). Se veía como un icono que
 * crece tarde y salta al final del vuelo.
 *
 * Como acá el viaje es una escala, no hace falta animar nada: alcanza con que
 * el subárbol nazca con las métricas del destino y la escala lo lleve. Se
 * emparejan los nodos por posición en el árbol; si las dos estructuras no
 * coinciden no se toca nada, porque tipografiar el nodo equivocado es peor que
 * no tipografiar ninguno.
 */
function syncDescendantTypography(clone, destination) {
  const cloneNodes = clone.querySelectorAll("*");
  const destinationNodes = destination.querySelectorAll("*");

  if (cloneNodes.length !== destinationNodes.length) return;

  cloneNodes.forEach((node, index) => {
    const styles = window.getComputedStyle(destinationNodes[index]);

    node.style.fontSize = styles.fontSize;

    // Material Symbols dibuja el trazo según `opsz`: sin copiarlo, el glifo
    // llega con la óptica del tamaño viejo y se corrige de golpe en el swap.
    if (
      styles.fontVariationSettings &&
      styles.fontVariationSettings !== "normal"
    ) {
      node.style.fontVariationSettings = styles.fontVariationSettings;
    }
  });
}

/**
 * Clona un shared element y lo deja montado EN SU DESTINO: con la caja, el
 * fontSize y el radio que va a tener cuando llegue. El vuelo después se hace
 * sólo con transform (ver animatePhantom).
 *
 * Es al revés de lo que parece natural, y es a propósito. Rasterizar el texto
 * al tamaño de destino y escalarlo hacia abajo significa que el glifo está en
 * su punto más nítido justo cuando aterriza, y que lo blando queda en la punta
 * lejana del viaje, donde el elemento es chico y va rápido. Rasterizar en el
 * origen y escalar hacia arriba haría lo contrario: llegaría borroso.
 */
function createPhantom(element, destinationRect, targetEl = null) {
  const phantom = element.cloneNode(true);
  const styles = window.getComputedStyle(element);
  const targetStyles = targetEl ? window.getComputedStyle(targetEl) : styles;
  const rect = destinationRect;

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
    borderRadius: targetEl
      ? radiusAsFourCorners(targetEl)
      : radiusAsFourCorners(element),
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
    // El texto se maqueta UNA sola vez, con la caja y la tipografía del
    // destino, y no vuelve a tocarse: el vuelo es puro transform. Por eso ya
    // no hace falta forzar `white-space: nowrap` (no hay re-wrap posible) ni
    // apagar el kerning con `text-rendering: optimizeSpeed` (no hay
    // re-rasterizado por frame que produzca tremble). El fantasma wrappea
    // exactamente igual que el elemento real al que va a reemplazar.
    willChange: "transform, opacity",
    fontSize: targetStyles.fontSize,
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

  if (targetEl) syncDescendantTypography(phantom, targetEl);

  document.body.appendChild(phantom);
  return phantom;
}

/**
 * Vuela el phantom desde el rect de origen hasta donde ya está montado (su
 * destino), usando SOLO transform: x/y para la posicion y scale para el
 * tamaño. Ni la caja ni el fontSize se tocan, asi que no hay layout por frame.
 *
 * Esto reemplaza al esquema anterior, que interpolaba width/height/fontSize y
 * ademas necesitaba animar a mano la tipografia de cada descendiente: `Icon`
 * escribe su font-size inline y el del phantom no lo alcanzaba, asi que el
 * glifo se quedaba clavado en el tamaño de origen y saltaba al final. Con una
 * escala todo el subarbol viaja junto y ese problema desaparece solo.
 */
function animatePhantom(
  phantom,
  fromRect,
  toRect,
  toBorderRadius,
  {
    duration = 0.6,
    ease = MODAL_MORPH_EASE,
    delay = 0,
    fromColor,
    toColor,
    fromWeight,
    toWeight,
  } = {},
) {
  gsap.set(phantom, {
    force3D: true,
    willChange: "transform, opacity",
    // La caja queda fija en el destino: el viaje entero es transform.
    top: toRect.top,
    left: toRect.left,
    width: toRect.width,
    height: toRect.height,
    borderRadius: toBorderRadius,
    transformOrigin: "0 0",
    x: 0,
    y: 0,
  });

  const tl = gsap.timeline();

  tl.fromTo(
    phantom,
    {
      x: fromRect.left - toRect.left,
      y: fromRect.top - toRect.top,
      scaleX: toRect.width ? fromRect.width / toRect.width : 1,
      scaleY: toRect.height ? fromRect.height / toRect.height : 1,
    },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, duration, ease, delay },
  );

  // El color es lo unico que no viaja en el transform, asi que se interpola
  // aparte para que el texto se funda con el estilo del destino en vez de
  // saltar en el swap final.
  if (fromColor && toColor && fromColor !== toColor) {
    tl.fromTo(
      phantom,
      { color: toGsapColor(fromColor) },
      {
        color: toGsapColor(toColor),
        duration: duration * PHANTOM_COLOR_RATIO,
        ease: PHANTOM_COLOR_EASE,
      },
      delay,
    );
  }

  // El peso SI viaja todo el trayecto y con la curva del morph, al reves que
  // el color. El color es identidad y se decide temprano; el peso es forma del
  // glifo, de la misma familia que el tamano, y el tamano viaja hasta el final.
  // Separarlos deja el texto engordando cuando ya dejo de crecer.
  //
  // Requiere una fuente variable — DM Sans se carga con el eje wght en
  // 100..1000, asi que el navegador interpola de verdad. Con una familia de
  // pesos estaticos el navegador salta al corte mas cercano y esto se ve peor
  // que no animarlo.
  if (fromWeight && toWeight && fromWeight !== toWeight) {
    tl.fromTo(
      phantom,
      { fontWeight: Number(fromWeight) },
      { fontWeight: Number(toWeight), duration, ease },
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

  // Espejo del anterior para el cierre: mientras hay un cierre en vuelo acá
  // vive la función que lo termina de golpe, para que una apertura no tenga
  // que esperar el medio segundo que dura.
  const settleCloseRef = useRef(null);

  // Vale true desde que arranca un cierre hasta un frame después de que
  // terminó de limpiar. Lo mira el reposicionamiento por resize para no
  // pisar la geometría que el cierre está animando (ver el effect de
  // REPOSICIONAMIENTO al final del hook).
  const isClosingRef = useRef(false);

  // Espejo de `triggerRef` para poder sacarlo de las dependencias del effect
  // de apertura sin quedarnos leyendo un valor viejo.
  //
  // `useModal` y `useInnerModal` construyen un objeto NUEVO ({element, rect})
  // en cada llamada a openModal. Con `triggerRef` en las dependencias, volver
  // a disparar el trigger con la modal YA abierta reejecutaba toda la
  // apertura encima de sí misma, aunque `isOpen` nunca hubiera cambiado.
  //
  // Y se dispara solo: el trigger queda en opacity 0 pero sigue siendo el
  // elemento con foco, así que un Enter lo activa de nuevo. Cada Enter
  // reproducía el FLIP entero — se veía como que la modal se cerraba y se
  // volvía a abrir — y encima la dejaba más chica, porque el remedido caía
  // sobre un modal que el FLIP anterior estaba redimensionando y tomaba un
  // tamaño intermedio como si fuera el final.
  //
  // La apertura ahora depende solo de `isOpen`. Reabrir sobre una modal
  // abierta no es una operación con sentido: si el trigger cambia de verdad,
  // el cierre igual usa el último (lo remide en vivo).
  // El valor inicial cubre el primer render (la apertura puede ocurrir en el
  // mismo commit en que se monta); el effect mantiene el espejo al día
  // después. Va declarado ANTES del effect de apertura para que, cuando los
  // dos corran en el mismo commit, el espejo ya esté actualizado.
  const triggerRefLatest = useRef(triggerRef);
  useEffect(() => {
    triggerRefLatest.current = triggerRef;
  }, [triggerRef]);

  // ANIMACIÓN DE APERTURA
  useEffect(() => {
    const modal = modalRef.current;
    const content = contentRef.current;
    const overlay = overlayRef?.current;

    // Leído del espejo y no de la prop: es lo que mantiene la apertura fuera
    // de las dependencias (ver triggerRefLatest arriba).
    const trigger = triggerRefLatest.current;

    // Normalizamos el trigger ya que este puede ser un objeto del hook useModal ({element, rect})
    // o un Ref de React estándar ({current: element})
    const element = trigger?.element || trigger?.current;
    if (!isOpen || !modal || !element) return;

    // Obtenemos el rect del trigger. Si viene precalculado en trigger.rect lo usamos
    // directamente para evitar un reflow innecesario.
    const rect = trigger.rect || element.getBoundingClientRect();

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

      // Si el usuario reabrió mientras la modal se estaba cerrando, primero
      // asentamos ese cierre: deja los estilos restaurados y no dispara
      // onClose, así la apertura arranca de un estado limpio en vez de
      // pelearse con un timeline en vuelo.
      settleCloseRef.current?.();
      modal.style.removeProperty("display");

      // Matamos cualquier tween activo sobre estos elementos para evitar conflictos
      // con animaciones anteriores que no hayan terminado (ej: re-apertura rápida).
      gsap.killTweensOf([modal, content, element, overlay]);

      // Activamos aceleración por GPU solo en el modal. El `content` solo hace
      // scroll, no se transforma, así que promoverlo a capa GPU es desperdicio
      gsap.set(modal, { force3D: true, willChange: "transform" });

      // El nodo del modal puede sobrevivir a un cierre anterior, y ese cierre
      // le dejó el PADDING del disparador puesto inline (lo fija para que el
      // Flip interpole la caja hacia la forma del botón). Si medimos con ese
      // residuo, el alto sale calculado con el padding chico del botón en vez
      // del propio: el modal termina clavado varias decenas de píxeles más
      // bajo de lo que necesita y recorta el contenido — el pie de botones
      // cortado por el borde. Volvemos al estado que dicta el CSS antes de
      // tomar la medida.
      gsap.set(modal, { clearProps: "padding,backgroundColor,color" });

      // Y por el mismo motivo soltamos la caja antes de medirla. El FLIP
      // escribe width/height inline en cada frame, y `min-height/min-width: 0`
      // sólo se retiran cuando la apertura termina de asentarse: si una
      // apertura anterior quedó a mitad de camino, `offsetWidth` no devuelve
      // el tamaño que dicta el CSS sino el interpolado de ese instante — más
      // chico. Medir eso y fijarlo como tamaño final es lo que hacía que la
      // modal se achicara un poco más en cada pasada.
      modal.style.removeProperty("min-height");
      modal.style.removeProperty("min-width");
      gsap.set(modal, { clearProps: "width,height" });

      // Medimos el tamaño final real del modal en su estado expandido.
      // Es importante hacerlo ANTES de modificar cualquier estilo para obtener valores correctos.
      const fullWidth = modal.offsetWidth;
      const fullHeight = modal.offsetHeight;
      const modalCs = window.getComputedStyle(modal);
      const finalBg = toGsapColor(modalCs.backgroundColor);
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
        clearProps:
          "position,top,left,width,height,boxSizing,overflow,flexGrow,flexShrink,flexBasis",
      });

      // Fijamos el content a su ancho final ANTES de que el FLIP anime el
      // modal. Sin esto, el content sigue el flujo del modal y su ancho
      // cambia frame a frame → el texto se re-wrappea visiblemente durante
      // la apertura. Con width fijo, el texto se layoutea una sola vez con
      // su forma final, y el overflow:hidden del modal lo recorta
      // progresivamente mientras crece.
      // El content sale del reparto flex y queda congelado en su caja final.
      // `flex-1` es `flex: 1 1 0%` y en el eje principal flex-basis le gana a
      // height, así que sin esto el content se encoge junto con la caja y el
      // texto se re-fluye al ancho de un botón durante todo el vuelo.
      gsap.set(content, {
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: "auto",
        width: content.offsetWidth,
        height: content.offsetHeight,
        transformOrigin: "0 0",
      });

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
      pinReadableColors([element, modal, ...triggerShared, ...modalShared]);

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
        triggerRect: rect,
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
        const toBR = radiusAsFourCorners(pair.target);
        const isImage = pair.source.tagName === "IMG";
        // Color del texto: interpolamos del source al target para que la
        // transición de color sea gradual. Solo aplicable a texto (no img).
        const fromColor = isImage
          ? null
          : window.getComputedStyle(pair.source).color;
        const toColor = isImage
          ? null
          : window.getComputedStyle(pair.target).color;
        const fromWeight = isImage
          ? null
          : window.getComputedStyle(pair.source).fontWeight;
        const toWeight = isImage
          ? null
          : window.getComputedStyle(pair.target).fontWeight;

        // El phantom nace montado sobre el DESTINO: la caja, el radio y la
        // tipografía del shared element dentro de la modal. El viaje se hace
        // después con transform, desde el rect del source.
        const phantom = createPhantom(pair.source, targetRect, pair.target);
        phantoms.push({ phantom, pair });

        // El target (elemento real dentro de la modal) se mantiene OCULTO
        // durante TODO el viaje del phantom. Usamos visibility:hidden + opacity:0
        // con !important inline para que el Flip.from(nested:true) no pueda
        // sobrescribirlo (nested anima los hijos del modal y podía restaurar la
        // visibilidad del target a mitad de animación). Solo se revela cuando
        // el deslizamiento termina (onComplete del FLIP más abajo).
        pair.target.style.setProperty("visibility", "hidden", "important");
        pair.target.style.setProperty("opacity", "0", "important");

        // Misma duración y misma curva que el FLIP de apertura: el phantom
        // llega en el mismo frame en que la caja termina de crecer. Costo por
        // frame: un transform. Nada de layout.
        animatePhantom(phantom, sourceRect, targetRect, toBR, {
          duration: MODAL_OPEN_DURATION,
          ease: MODAL_MORPH_EASE,
          fromColor,
          toColor,
          fromWeight,
          toWeight,
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
        // Cuando responsive es false dejamos el ANCHO pinneado a propósito:
        // es el camino barato, sin listeners ni relayouts mientras esté
        // abierto.
        if (responsive) {
          gsap.set(content, { clearProps: "width" });
          gsap.set(modal, { clearProps: "width" });
        }

        // El ALTO se suelta siempre. Es lo único que el contenido cambia
        // mientras el modal está abierto: un formulario que pasa de cinco
        // campos a dos tiene que encogerse, y un `h-screen md:h-auto` que
        // venga en `styles` tiene que poder ganar. Con un height inline en
        // píxeles ninguna clase puede: el modal queda clavado en el alto que
        // midió al abrir y le sobra o le falta caja para siempre.
        gsap.set(modal, { clearProps: "height" });

        gsap.set(modal, {
          willChange: "auto",
          clearProps: "backgroundColor,color,padding",
        });

        // El content vuelve al reparto flex. Aterriza con la misma caja que
        // tenía congelada, así que soltarlo no reflowea nada visible.
        gsap.set(content, {
          clearProps:
            "filter,opacity,transform,transformOrigin,height,flexGrow,flexShrink,flexBasis",
        });

        releaseReadableColors([
          element,
          modal,
          ...triggerShared,
          ...modalShared,
        ]);

        // Con la apertura ya asentada, el drag no tiene nada que terminar.
        // Dejar el ref vivo hacía que el PRIMER drag reaplicara todo este
        // finalize sobre una modal ya abierta y scrolleada: el progress(1)
        // del timeline y los clearProps de width/height reflowean el
        // scroller, y el navegador le recorta el scrollTop al usuario. Del
        // segundo drag en adelante el ref ya estaba consumido y el scroll
        // se respetaba — de ahí que el salto se viera una sola vez.
        settleOpenRef.current = null;
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

      // La piel del trigger (su color) se despega en 0.3s mientras la caja
      // sigue creciendo hasta los 0.7s: la forma de botón se pierde mucho
      // antes de que el modal termine de llegar a su tamaño.
      tl.fromTo(
        modal,
        {
          backgroundColor: toGsapColor(
            window.getComputedStyle(element).backgroundColor,
          ),
        },
        {
          backgroundColor: finalBg,
          duration: 0.3,
          ease: MODAL_MORPH_EASE,
        },
        0,
      );

      // LA SEGUNDA CAPA. La caja morfea y el content escala adentro, en X y
      // en Y por separado, desde la esquina. Sin esto los números de arriba
      // sólo hacen la apertura más lenta: lo que se lee como "creció" es que
      // el contenido acompañe la deformación de la caja, no que aparezca
      // dentro de ella. Entra además desenfocado, como una superficie que
      // enfoca en vez de un texto que ya estaba puesto.
      tl.fromTo(
        content,
        {
          scaleX: rect.width / fullWidth,
          scaleY: rect.height / fullHeight,
          opacity: 0,
          filter: `blur(${CONTENT_OPEN_BLUR}px)`,
        },
        {
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          filter: "blur(0px)",
          transformOrigin: "0 0",
          duration: MODAL_OPEN_DURATION,
          ease: MODAL_MORPH_EASE,
        },
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
          {
            backgroundColor: OVERLAY_COLOR,
            duration: OVERLAY_OPEN_DURATION,
            ease: overlayTintEase,
          },
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
        releaseReadableColors([element]);

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
      isClosingRef.current = true;

      // `cleanup` puede llegar por tres caminos (onComplete, onInterrupt y el
      // asentamiento desde una apertura nueva), así que corre una sola vez.
      let closeSettled = false;
      let suppressOnClose = false;

      // La página vuelve a ser clickeable EN EL MISMO FRAME en que arranca el
      // cierre, no cuando termina. El overlay es un `fixed inset-0` que sigue
      // montado durante toda la animación: sin esto se traga cada click de
      // los 0.5s que dura el cierre y se siente como que la interfaz quedó
      // trabada. El modal también, para que un segundo click no reentre acá.
      if (overlay) gsap.set(overlay, { pointerEvents: "none" });
      gsap.set(modal, { pointerEvents: "none" });

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
        // El open ocultó el trigger con opacity 0 !important: un tween normal
        // jamás lo pisa, así que primero liberamos los !important, pinneamos
        // en 0 y recién ahí tuneamos a 1 con el delay del crossfade.
        element.style.removeProperty("opacity");
        // La transicion inline sigue pinneada en `none` durante todo el
        // restore, y NO se libera aca. El disparador suele traer
        // `transition-all duration-200` en su clase: con esa transicion viva,
        // cada valor de opacidad que GSAP escribe frame a frame queda atrapado
        // en sus 200ms, asi que el boton va siempre atrasado respecto del
        // tween y todavia no llego a 1 cuando el tween ya termino. La
        // diferencia se salda de golpe en el ultimo frame — ese es el brinco
        // que quedaba. Mientras GSAP sea dueno de la opacidad, el CSS no
        // opina. Es la misma precaucion que ya toma createPhantom con el clon.
        gsap.set(element, { opacity: 0 });
        // power1.inOut y no power2.out: un ease-out sobre una opacidad 0 -> 1
        // esta cargado al principio (la mitad del fade se resuelve en el
        // primer quinto), asi que el boton irrumpe y despues se arrastra. Eso
        // es exactamente lo que se veia como "sale de repente".
        gsap.to(element, {
          opacity: 1,
          duration: TRIGGER_RESTORE_DURATION,
          ease: "power1.inOut",
          delay: TRIGGER_RESTORE_DELAY,
          onComplete: () => {
            gsap.set(element, { clearProps: "opacity" });
            // La transicion vuelve un frame despues de soltar la opacidad. En
            // el mismo frame, el paso de opacidad inline a la computada
            // volveria a viajar por esos 200ms y reintroduciria el brinco.
            requestAnimationFrame(() =>
              element.style.removeProperty("transition"),
            );
          },
        });
      }

      // Ocultamos overflow para que el contenido del modal no se desborde
      gsap.set(modal, { overflow: "hidden" });

      // FIjamos la altura en px antes de sacar el content del flujo.
      const modalCurrentRect = modal.getBoundingClientRect();
      gsap.set(modal, { height: modalCurrentRect.height });

      // Convertimos el scroll en un transform ANTES de que el FLIP encoja
      // la modal, y dejamos el scroller en cero.
      //
      // scrollTop no es un valor nuestro: el navegador lo recorta solo a
      // [0, scrollHeight - clientHeight] cada vez que recalcula la
      // geometría del scroller. Y durante el cierre esa geometría cambia
      // en cada frame — la modal colapsa al tamaño del trigger, el content
      // se va con ella y el FLIP anima width/height. Alcanza UN frame en
      // el que el recorte se aplique para que el scroll se pierda, y eso
      // es lo que se ve como "la modal me devuelve al tope antes de
      // cerrarse". Congelar la caja y reasignar scrollTop no lo evita:
      // solo achica la ventana en la que puede pasar.
      //
      // Un transform, en cambio, no participa del layout ni de la
      // geometría de scroll, así que no hay nada que el navegador pueda
      // recortar. Trasladamos los hijos hacia arriba exactamente lo que el
      // usuario había scrolleado: el resultado visual es idéntico al del
      // scroll, pero inmutable durante todo el cierre.
      const scrolledBy = content.scrollTop;
      const scrolledChildren = Array.from(content.children);
      const contentRect = content.getBoundingClientRect();

      // La caja del content igual se congela y sale del reparto flex
      // (`flex-1` es `flex: 1 1 0%`, y en el eje principal flex-basis le
      // gana a height). Sin esto el content se encoge junto con la modal
      // y el contenido se re-fluye al ancho de un botón durante el vuelo.
      gsap.set(content, {
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: "auto",
        width: contentRect.width,
        height: contentRect.height,
        overflow: "hidden",
      });

      if (scrolledBy > 0) {
        gsap.set(scrolledChildren, { y: -scrolledBy });
        content.scrollTop = 0;
      }

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

        // Si el usuario scrolleó y el shared element quedó fuera de la
        // pantalla, no hay nada que hacer volar. El phantom nacería en una
        // posición que nadie está mirando y entraría barriendo desde el
        // borde — que es justo lo que se lee como "la modal me devolvió al
        // tope". Dejamos ese par afuera del cierre: el target queda visible
        // dentro de la modal que se encoge y el trigger conserva su
        // contenido, porque no va a llegarle ningún phantom.
        const isOnScreen =
          targetRect.bottom > 0 &&
          targetRect.right > 0 &&
          targetRect.top < window.innerHeight &&
          targetRect.left < window.innerWidth;
        if (!isOnScreen) continue;

        // El phantom nace montado sobre el DESTINO del viaje — el shared
        // element del trigger — con su caja, su radio y su tipografía. De ahí
        // sale volando hacia atrás con un transform. Guardamos el rect del
        // target porque es el punto de partida y el phantom ya no está ahí.
        const phantom = createPhantom(
          pair.target,
          pair.source.getBoundingClientRect(),
          pair.source,
        );
        const isImage = pair.target.tagName === "IMG";
        const fromColor = isImage
          ? null
          : window.getComputedStyle(pair.target).color;
        const fromWeight = isImage
          ? null
          : window.getComputedStyle(pair.target).fontWeight;
        closePhantoms.push({
          phantom,
          pair,
          targetRect,
          fromColor,
          fromWeight,
        });

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
      gsap.set(content, { willChange: "opacity, filter, transform" });

      pinReadableColors([element, modal, ...modalShared]);

      // Aqui capturamos los estilos actuales del modal abierto.
      // El borde y la sombra viajan con la caja. Sin ellos, el ultimo frame
      // del cierre es una pastilla con sombra y sin borde parada encima de un
      // boton con borde y sin sombra: al retirar la modal las dos diferencias
      // aparecen juntas, y eso es el salto. La caja tiene que ATERRIZAR ya
      // vestida de boton para que sacarla no cambie nada.
      const modalShadow = window.getComputedStyle(modal).boxShadow;

      const state = Flip.getState([modal, ...modalShared], {
        props: "backgroundColor,color,padding,boxShadow,borderWidth,borderColor",
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
        boxShadow: matchedShadow(modalShadow, triggerStyles.boxShadow),
        // El estilo se fuerza a solid en los dos extremos para que lo unico
        // que cambie sea el ancho: `none` no es un valor intermedio, asi que
        // un borde que nace o muere cambiando de estilo salta en vez de
        // crecer. Con ancho 0 el borde es invisible igual.
        borderStyle: "solid",
        borderWidth: triggerStyles.borderTopWidth,
        borderColor: toGsapColor(triggerStyles.borderTopColor),
        // El fondo tiene que viajar al del disparador o la caja aterriza
        // blanca encima del botón y se ve un destello justo cuando el
        // trigger está reapareciendo. El Flip lo interpola solo: capturó el
        // color del modal abierto y acá le fijamos el destino.
        backgroundColor: toGsapColor(triggerStyles.backgroundColor),
        overflow: "hidden",
        margin: 0,
      });

      // Reactivamos aceleración GPU solo en el modal para la animación de cierre.
      gsap.set(modal, { force3D: true, willChange: "transform" });

      // Ahora que calculamos las posiciones finales del trigger, animamos los
      // phantoms de vuelta. El punto de partida es el rect que el shared
      // element tenía dentro de la modal; el de llegada, el del trigger.
      for (const {
        phantom,
        pair,
        targetRect,
        fromColor,
        fromWeight,
      } of closePhantoms) {
        const sourceRect = pair.source.getBoundingClientRect();
        const toBR = radiusAsFourCorners(pair.source);
        const isImage = pair.source.tagName === "IMG";
        const toColor = isImage
          ? null
          : window.getComputedStyle(pair.source).color;
        const toWeight = isImage
          ? null
          : window.getComputedStyle(pair.source).fontWeight;

        // Misma duración y misma curva que el FLIP de cierre: el phantom
        // tiene que llegar al trigger en el mismo frame que la caja, o el
        // desfasaje se lee como un brinco y no como un morph.
        animatePhantom(phantom, targetRect, sourceRect, toBR, {
          duration: MODAL_CLOSE_DURATION,
          ease: MODAL_MORPH_EASE,
          fromColor,
          toColor,
          fromWeight,
          toWeight,
        });
      }

      // Función de limpieza que se llama al terminar la animación.
      // Elimina los overrides de min-height, restaura el trigger y llama a onClose
      // para que React desmonte el modal del DOM.
      function cleanup() {
        if (closeSettled) return;
        closeSettled = true;
        delete modal.dataset.closing;
        // El nodo puede sobrevivir al cierre (hay modales que se quedan
        // montadas con isOpen=false), así que devolvemos los eventos o la
        // próxima apertura nacería sin poder recibir clicks.
        gsap.set(modal, { clearProps: "pointerEvents" });
        if (overlay) gsap.set(overlay, { clearProps: "pointerEvents" });
        releaseReadableColors([element, modal, ...modalShared]);
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
        // Y el padding/colores que el cierre le copió del disparador. Si el
        // nodo sobrevive al cierre y los dejamos puestos, la próxima apertura
        // mide su alto con el padding del botón.
        gsap.set(modal, {
          clearProps:
            "padding,backgroundColor,color,boxShadow,borderWidth,borderColor,borderStyle",
        });
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
        // el viaje de los phantoms de cierre.
        content.style.removeProperty("visibility");
        // Deshacemos la conversión scroll -> transform y la caja congelada.
        // El nodo del modal sobrevive al cierre (siempre se rendera por el
        // portal, solo se oculta), así que si dejáramos estos inline la
        // próxima apertura arrancaría con el content desplazado y fuera
        // del reparto flex.
        gsap.set(scrolledChildren, { clearProps: "transform,x,y" });
        // La deriva del content dura 2s y el cierre termina a los 0.5s: si no
        // la matamos acá sigue escribiendo transforms sobre un modal ya
        // cerrado y la próxima apertura arranca con el content encogido.
        gsap.killTweensOf(content);
        gsap.set(content, {
          clearProps:
            "flexGrow,flexShrink,flexBasis,width,height,overflow,opacity,filter,transform,transformOrigin,willChange",
        });
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

        // Este cierre ya no tiene nada que asentar. Sin esto el ref queda
        // vivo con el timeline viejo y la PRÓXIMA apertura lo invoca:
        // `tl.progress(1)` reaplica los valores finales de un cierre que ya
        // pasó (modal en opacity 0, encogido al botón) justo cuando la
        // apertura estaba montando el suyo.
        settleCloseRef.current = null;

        // El flag se libera un frame DESPUÉS de limpiar. Los clearProps de
        // acá arriba devuelven el modal a su tamaño natural, y ese cambio
        // dispara el ResizeObserver del reposicionamiento: si el flag ya
        // estuviera en false, esa pasada escribiría un top/left calculado
        // sobre un modal que está en display:none (offsetWidth 0).
        requestAnimationFrame(() => {
          isClosingRef.current = false;
        });

        // Si el usuario reabrió mientras esto cerraba, el estado ya lo tomó
        // la apertura nueva: llamar a onClose acá la desmontaría de vuelta.
        // Es exactamente lo que se veía como "no puedo reabrir la modal".
        if (!suppressOnClose) onClose();
      }

      // Timeline del cierre. onInterrupt garantiza que se aplique la funcion cleanup aunque el usuario
      // interrumpa la animación antes de que termine
      const tl = gsap.timeline({ onComplete: cleanup, onInterrupt: cleanup });

      // Puente para que una apertura pueda ASENTAR este cierre de golpe en
      // vez de esperarlo. Sin esto, reabrir durante el medio segundo del
      // cierre no funciona: la apertura monta la modal y el cierre, al
      // terminar, llama a onClose y la vuelve a desmontar.
      settleCloseRef.current = () => {
        suppressOnClose = true;
        tl.progress(1);
        cleanup();
        settleCloseRef.current = null;
      };

      // El overlay se apaga con la misma duración que la caja pero con
      // power3.in: se queda casi opaco hasta el final y recién ahí cae.
      // Por eso el cierre no se lee como un rebobinado — el fondo todavía
      // se está asentando cuando la caja ya llegó al trigger.
      if (overlay) {
        tl.to(
          overlay,
          {
            backgroundColor: "rgba(0,0,0,0)",
            duration: MODAL_CLOSE_DURATION,
            ease: "power3.in",
          },
          0,
        );
      }

      // La caja vuelve al trigger con la MISMA curva que usó para salir,
      // pero en 0.5s en vez de 0.7s. Los extremos coinciden, las curvas no:
      // el cierre es más corto y el contenido se va antes que la caja.
      // Al animar backgroundColor la caja aterriza con el color del botón,
      // que es lo que vende que la modal se volvió el trigger.
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: MODAL_CLOSE_DURATION,
          ease: MODAL_MORPH_EASE,
          props: "backgroundColor,color,padding",
        }),
        0,
      );

      // El contenido se disuelve con el desenfoque grande de una superficie
      // completa. Un solo nodo en vez de las ramas sueltas: al animarlo
      // entero se crea UNA capa de compositing y no una por rama.
      tl.to(
        content,
        {
          opacity: 0,
          filter: `blur(${CONTENT_CLOSE_BLUR}px)`,
          duration: MODAL_CLOSE_DURATION,
          ease: MODAL_CLOSE_BLUR_EASE,
        },
        0,
      );

      // El content encoge con una duración mucho más larga que la caja: a
      // los 0.5s recorrió apenas un cuarto del camino, así que queda casi a
      // tamaño real y es la caja la que lo recorta al irse. Eso es lo que se
      // lee como "la caja se cerró encima" y no como una foto que se chupa
      // al botón.
      //
      // Va FUERA del timeline a propósito. Adentro, sus 2s pasaban a ser la
      // duración del timeline entero y `onComplete: cleanup` disparaba recién
      // ahí: la modal no se desmontaba, el trigger quedaba con los inline del
      // cierre y la reapertura arrancaba rota. Lo mata `cleanup`.
      gsap.to(content, {
        scaleX: triggerRect.width / modalCurrentRect.width,
        scaleY: triggerRect.height / modalCurrentRect.height,
        transformOrigin: "0 0",
        duration: CONTENT_CLOSE_DRIFT_DURATION,
        ease: MODAL_MORPH_EASE,
      });

      // Ajustamos el borderRadius gradualmente para que al final coincida con el del trigger.
      // clip-path en vez de borderRadius: GPU-compositable, sin paint.
      tl.to(
        modal,
        {
          clipPath: `inset(0 round ${triggerStyles.borderRadius})`,
          duration: MODAL_CLOSE_DURATION,
          ease: MODAL_CLOSE_SHAPE_EASE,
        },
        0,
      );

      // La caja NO se desvanece durante el viaje: tiene que llegar entera,
      // con el color y el radio del botón, porque ese aterrizaje es el que
      // se lee como "la modal se volvió el trigger". Recién en el último
      // cuarto se apaga, cruzándose con el trigger que ya está apareciendo
      // (TRIGGER_RESTORE_DELAY + TRIGGER_RESTORE_DURATION terminan en el
      // mismo frame). Es una fracción del cierre y no un valor fijo: con un
      // cierre corto, 0.12s absolutos se comían un tercio del viaje.
      tl.to(
        modal,
        {
          opacity: 0,
          duration: MODAL_CLOSE_DURATION * 0.24,
          ease: "power2.in",
        },
        MODAL_CLOSE_DURATION * 0.76,
      );
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

      // Y lo mismo con el cierre, que es donde más se notaba: el FLIP encoge
      // el modal hasta la caja del botón animando width/height inline, así
      // que el ResizeObserver de acá abajo dispara en CADA frame del vuelo.
      // El cierre ancla el modal con top/left = rect del trigger y deja que
      // el FLIP haga el viaje con un transform que termina en cero — o sea
      // que el top/left inline ES el destino. Reposicionar durante el vuelo
      // lo reescribía con una posición recalculada a partir del tamaño
      // intermedio (y del clamping contra los bordes), y como el transform
      // igual terminaba en cero, el modal aterrizaba donde lo hubiera dejado
      // el ÚLTIMO frame del observer en vez de sobre el botón. Eso es lo que
      // se veía como "la modal cierra en un lugar random".
      if (isClosingRef.current) return;

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

    // El alto lo maneja el CSS, así que el modal cambia de tamaño solo cuando
    // cambia su contenido — un formulario que pasa de cinco campos a dos. Si
    // no lo re-anclamos, un modal centrado se queda colgado del top viejo y
    // encoge sólo desde abajo.
    //
    // El observer dispara una vez apenas se llama a observe(): esa primera
    // pasada la descartamos, porque no describe ningún cambio real y llegaría
    // mientras la apertura todavía está en vuelo.
    let firstObservation = true;
    const observer = new ResizeObserver(() => {
      if (firstObservation) {
        firstObservation = false;
        return;
      }
      onResize();
    });
    observer.observe(modal);

    // Opt-in: sin responsive no escuchamos el resize de la ventana. Ese
    // camino recalcula además el ancho y es el que cuesta.
    if (responsive) window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
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
