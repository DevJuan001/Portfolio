import { useCallback, useEffect } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Flip);
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
 */
function createPhantom(element, rect) {
  const phantom = element.cloneNode(true);
  const styles = window.getComputedStyle(element);

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
    overflow: "hidden",
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
    willChange: "transform, width, height, top, left, border-radius, opacity",
    fontWeight: styles.fontWeight,
    fontFamily: styles.fontFamily,
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
 * Anima un phantom desde su rect actual hasta un rect destino, interpolando
 * ADEMÁS el borderRadius y, opcionalmente, el fontSize desde el valor del
 * source hasta el del target. Animar fontSize (en lugar de transform: scale)
 * hace que el texto CREZCA de forma nativa — el browser re-rasteriza en
 * cada frame, evitando el blur que produce scale.
 *
 * El roundProps redondea el fontSize a enteros en cada frame para que el
 * text rendering no fluctúe en valores subpixel (eso causa el "temblor"
 * que se ve en textos de una sola palabra). El crecimiento se ve en pasos
 * de 1px que son imperceptibles a 60fps.
 *
 * Usa expo.out (la misma curva que el FLIP de apertura) para que el
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
    ease = "expo.out",
    delay = 0,
    fromFontSize,
    toFontSize,
  } = {},
) {
  gsap.set(phantom, {
    force3D: true,
    willChange: "transform,width,height,top,left,border-radius,opacity",
  });

  const tl = gsap.timeline();

  // 1) Caja: posición, tamaño, borderRadius. Redondeamos solo top/left a
  //    enteros (para evitar subpixel positioning del box). NO redondeamos
  //    width/height porque cuando el recorrido del phantom es corto, el
  //    cambio de width/height por frame es < 1px y el roundProps hacía que
  //    el box se quedara atascado en el tamaño del source durante casi todo
  //    el vuelo, saltando al tamaño del target solo al final → eso causaba
  //    que el texto no creciera de forma smooth y se viera un tremble
  //    cerca del destino. Con subpixel smooth en width/height, el box
  //    crece de forma continua y el texto acompanha sin saltos.
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
      roundProps: ["top", "left", "borderRadius"],
    },
  );

  // 2) Font-size: interpolamos desde el del source hasta el del target
  //    para que el texto/icono crezca de forma smooth y nativa. Usamos
  //    roundProps para que el rendering no fluctúe en subpixels.
  if (fromFontSize && toFontSize && fromFontSize !== toFontSize) {
    tl.fromTo(
      phantom,
      { fontSize: fromFontSize },
      {
        fontSize: toFontSize,
        duration,
        ease,
        delay,
        roundProps: ["fontSize"],
      },
      delay,
    );
  }

  return tl;
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
}) => {
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

      // Activamos aceleración por GPU en ambos elementos para suavizar la animación.
      gsap.set(modal, { force3D: true, willChange: "transform" });
      gsap.set(content, { force3D: true });

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

      // FLIP — paso "First": capturamos el estado actual del trigger (posición, tamaño,
      // borderRadius, colores). Este será el punto de inicio de la animación.
      const state = Flip.getState([element, ...triggerShared], {
        props: "borderRadius,backgroundColor,color,padding",
      });

      // Ocultamos el trigger mientras el modal está visible para que no se vea doble.
      // Desactivamos primero cualquier transition CSS (transition-opacity /
      // transition-colors de Tailwind) para que el cambio sea INSTANTÁNEO
      // y no se quede visible mientras la transition anima el opacity a 0.
      if (hideTrigger) {
        element.style.setProperty("transition", "none", "important");
        element.style.setProperty("opacity", "0", "important");
      }

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
          if (triggerRef?.rect || rect) {
            const r = triggerRef.rect || rect;

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
        backgroundColor: finalBg,
        borderRadius: finalBorderRadius,
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
        // Font-size del source y del target para interpolarlo durante el
        // vuelo. Solo aplicable a texto/iconos (no a imágenes).
        const isImage = pair.source.tagName === "IMG";
        const fromFontSize = isImage
          ? null
          : window.getComputedStyle(pair.source).fontSize;
        const toFontSize = isImage
          ? null
          : window.getComputedStyle(pair.target).fontSize;

        // Creamos el phantom posicionado sobre el elemento fuente, con la
        // forma (borderRadius) visible del source.
        const phantom = createPhantom(pair.source, sourceRect);
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
        // los del target. El borderRadius y el fontSize se interpolan para
        // que el elemento vaya tomando poco a poco la forma y el tamaño del
        // destino mientras se desliza, evitando el brinco al hacer el swap.
        // Usamos la MISMA duración (0.38s) y la MISMA curva (expo.out) que
        // el FLIP de apertura del modal, así el deslizamiento va al mismo
        // ritmo que la apertura y no se siente rezagado/lento.
        animatePhantom(phantom, sourceRect, targetRect, fromBR, toBR, {
          duration: 0.6,
          ease: "expo.out",
          fromFontSize,
          toFontSize,
        });
      }

      const tl = gsap.timeline();

      // Aqui comparamos el estado guardado (trigger)
      // contra el estado actual (modal expandido) y animamos la transición entre ambos.
      // nested:true permite que los shared elements internos también se animen correctamente.
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: 0.6,
          ease: "expo.out",
          props: "backgroundColor,color,padding",
          onComplete: () => {
            if (cancelled) return;

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
            gsap.set(content, {
              overflowY: "auto",
            });
            gsap.set(modal, {
              willChange: "auto",
              height: "auto",
              clearProps: "backgroundColor,color,padding",
            });
          },
        }),
      );

      // Transición explícita del borderRadius desde el del trigger hasta el
      // final de la modal. La sacamos de los props del FLIP para poder
      // ajustarla independientemente y mantener consistencia con el cierre,
      // que también la anima con un tween propio. Usamos sine.in para que
      // el borde empiece a cambiar pronto en el vuelo y se asiente antes
      // de terminar, sin el delay marcado de power2.in.
      tl.fromTo(
        modal,
        { borderRadius: triggerBorderRadius },
        { borderRadius: finalBorderRadius, duration: 0.6, ease: "sine.in" },
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
    });

    // Aqui limpiamos la modal si el componente se desmonta o si isOpen cambia
    // antes de que el frame se ejecute. Garantiza que el trigger quede visible.
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      // Limpiamos cualquier phantom que haya quedado huérfano
      document
        .querySelectorAll(".shared-element-phantom")
        .forEach((p) => p.remove());
      if (element) {
        if (hideTrigger) {
          element.style.removeProperty("opacity");
          gsap.set(element, {
            opacity: 1,
            clearProps: "opacity",
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

      // Fijamos la posición y tamaño del contenido como absolute para que no afecte al layout del la modal
      const contentRect = content.getBoundingClientRect();
      gsap.set(content, {
        position: "absolute",
        top: content.offsetTop,
        left: content.offsetLeft,
        width: contentRect.width,
        height: contentRect.height,
        boxSizing: "border-box",
      });

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
        // forma (borderRadius) visible del target. Guardamos fromBR y fromFontSize
        // para interpolarlos hasta los valores del source en el viaje de vuelta.
        const phantom = createPhantom(pair.target, targetRect);
        const fromBR = radiusAsFourCorners(pair.target);
        const isImage = pair.target.tagName === "IMG";
        const fromFontSize = isImage
          ? null
          : window.getComputedStyle(pair.target).fontSize;
        closePhantoms.push({ phantom, pair, fromBR, fromFontSize });

        // Ocultamos el shared element DENTRO del trigger con un fade suave.
        // El botón (trigger) permanece visible — solo se desvanece el
        // texto/icono que va a ser "reemplazado" por el phantom del modal
        // durante el vuelo el contenedor nunca se va.
        gsap.to(pair.source, { opacity: 0, duration: 0.15, ease: "power2.in" });
      }

      // Ocultamos el contenido de la modal al inicio del cierre para que solo
      // se vea el phantom volando de vuelta al trigger. Sin esto, el content
      // (position:absolute con dimensiones fijas) se recorta por el
      // overflow:hidden de la modal mientras se encoge con FLIP → el texto
      // se ve "rodando" durante la animación.
      gsap.set(content, { opacity: 0 });

      // Aqui capturamos los estilos actuales del modal abierto.
      const state = Flip.getState([modal, ...modalShared], {
        props: "backgroundColor,color,padding",
      });

      // Prevención extra por si element fue liberado entre líneas
      if (!element) return;

      const triggerRect = triggerRef.rect || element.getBoundingClientRect();
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
        backgroundColor: triggerStyles.backgroundColor,
        color: triggerStyles.color,
        overflow: "hidden",
        margin: 0,
      });

      // Reactivamos aceleración GPU para la animación de cierre
      gsap.set(modal, { force3D: true, willChange: "transform" });
      gsap.set(content, { force3D: true });

      // Ahora que calculamos las posiciones finales del trigger, animamos los phantoms de vuelta.
      // El borderRadius y el fontSize se interpolan desde los valores del
      // target (modal) hasta los del source (trigger) para que el elemento
      // vaya recuperando su forma y tamaño original mientras se desliza.
      for (const { phantom, pair, fromBR, fromFontSize } of closePhantoms) {
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

        // Misma duración (0.25s) y misma curva (power3.inOut) que el FLIP
        // de cierre, así el deslizamiento de vuelta va al mismo ritmo que
        // el cierre del modal.
        animatePhantom(phantom, currentRect, sourceRect, fromBR, toBR, {
          duration: 0.35,
          ease: "power3.inOut",
          fromFontSize,
          toFontSize,
        });
      }

      // Función de limpieza que se llama al terminar la animación.
      // Elimina los overrides de min-height, restaura el trigger y llama a onClose
      // para que React desmonte el modal del DOM.
      function cleanup() {
        delete modal.dataset.closing;
        modal.style.removeProperty("min-height");
        modal.style.removeProperty("min-width");
        gsap.set(modal, { willChange: "auto" });
        // Restauramos la visibilidad del content que ocultamos durante el
        // viaje de los phantoms de cierre.
        content.style.removeProperty("visibility");
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

          // Desvanecemos el phantom lentamente para que el source (ya a
          // opacity 1) se vaya revelando de forma progresiva y nativa.
          gsap.to(phantom, {
            opacity: 0,
            duration: 0.18,
            ease: "power1.out",
            onComplete: () => phantom.remove(),
          });

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
      // hasta el estado del trigger. Usamos una curva S suave (power3.inOut) estilo.
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: 0.35,
          ease: "power3.inOut",
          props: "backgroundColor,color,padding",
        }),
        0,
      );

      // Ajustamos el borderRadius gradualmente para que al final coincida con el del trigger
      tl.to(
        modal,
        {
          borderRadius: triggerStyles.borderRadius,
          duration: 0.3,
          ease: "power2.inOut",
        },
        0.04,
      );

      // El modal hace fade out revelando el contenido del botón de forma natural
      tl.to(modal, { opacity: 0, duration: 0.07, ease: "power1.inOut" }, 0.28);
    },
    [onClose, triggerRef, modalRef, contentRef, overlayRef, id, hideTrigger],
  );

  return { closeModal };
};
