import { useCallback, useEffect } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Flip);
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
      const finalBg = window.getComputedStyle(modal).backgroundColor;

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
      // Usamos !important para ganar sobre cualquier estilo CSS que pueda traer.
      element.style.setProperty("opacity", "0", "important");

      // Cálculo de posición final del modal
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Margen que minimo que aplicaremos al modal container
      const margin = 20;

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
        borderRadius: "32px",
        overflow: "hidden",
        clearProps: "transform,x,y,scale,xPercent,yPercent",
      });

      const tl = gsap.timeline();

      // Aqui comparamos el estado guardado (trigger)
      // contra el estado actual (modal expandido) y animamos la transición entre ambos.
      // nested:true permite que los shared elements internos también se animen correctamente.
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: 0.38,
          ease: "expo.out",
          props: "borderRadius,backgroundColor,color,padding",
          onComplete: () => {
            if (cancelled) return;
            // Restauramos min-height/min-width que habíamos anulado para la animación
            modal.style.removeProperty("min-height");
            modal.style.removeProperty("min-width");

            gsap.set(modal, {
              overflowY: "auto",
              willChange: "auto",
              height: "auto",
              clearProps: "backgroundColor,color,padding",
            });

            // Mantenemos el trigger oculto mientras el modal siga abierto
            element.style.setProperty("opacity", "0", "important");
          },
        }),
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
      if (element) {
        element.style.removeProperty("opacity");
        gsap.set(element, {
          opacity: 1,
          clearProps: "opacity",
        });
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

      // Restauramos el trigger temporalmente a visible para poder leer su estilos
      element.style.removeProperty("opacity");
      gsap.set(element, { opacity: 1 });

      // Ocultamos el trigger durante la animación
      gsap.set(element, { opacity: 0 });

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

      // Función de limpieza que se llama al terminar la animación.
      // Elimina los overrides de min-height, restaura el trigger y llama a onClose
      // para que React desmonte el modal del DOM.
      function cleanup() {
        delete modal.dataset.closing;
        modal.style.removeProperty("min-height");
        modal.style.removeProperty("min-width");
        gsap.set(modal, { willChange: "auto" });
        gsap.set(element, {
          opacity: 1,
          clearProps: "opacity",
        });
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
            duration: 0.2,
            ease: "power1.inOut",
          },
          0,
        );
      }

      // El contenido se encoge y desvanece con un sutil empuje vertical
      // para dar sensación de profundidad (estilo Apple)
      tl.to(
        content,
        { scale: 0.92, opacity: 0, y: 8, duration: 0.1, ease: "power2.in" },
        0,
      );

      // Aqui animamos la modal desde su estado grande o abierto capturandolo con state
      // hasta el estado del trigger. Usamos una curva S suave (power3.inOut) estilo Apple.
      tl.add(
        Flip.from(state, {
          targets: [modal, ...modalShared],
          nested: true,
          duration: 0.25,
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
          duration: 0.21,
          ease: "power2.inOut",
        },
        0.025,
      );

      // Revelamos el trigger debajo del modal justo antes de que termine
      tl.set(element, { opacity: 1 }, 0.2);

      // El modal hace fade out revelando el contenido del botón de forma natural
      tl.to(modal, { opacity: 0, duration: 0.05, ease: "power1.inOut" }, 0.2);
    },
    [onClose, triggerRef, modalRef, contentRef, overlayRef, id],
  );

  return { closeModal };
};
