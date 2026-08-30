import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { useLayoutEffect, useRef } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(CustomEase);
}

const SLIDE_DURATION = 0.55;

// Los dos bordes de la pildora viajan con curvas distintas: el que va
// adelante en el sentido del movimiento arranca de una y el de atrás sale
// tarde y lo alcanza. Esa diferencia estira la pildora a mitad de camino
// y la deja exacta al aterrizar. Con una sola curva no hay arrastre, hay
// una caja que se teletransporta despacio.
const LEADING_EASE = "tabsLeadingEdge";
const TRAILING_EASE = "tabsTrailingEdge";

if (typeof window !== "undefined") {
  CustomEase.create(LEADING_EASE, "M0,0 C0.2,1 0.3,1 1,1");
  CustomEase.create(TRAILING_EASE, "M0,0 C0.65,0 0.25,1 1,1");
}

export const useTabs = ({ activeTab = 0 } = {}) => {
  const listRef = useRef(null);
  const indicatorRef = useRef(null);
  const tabsRef = useRef([]);
  const edges = useRef(null);

  const registerTab = (index) => (node) => {
    tabsRef.current[index] = node;
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const measure = () => {
      const tab = tabsRef.current[activeTab];
      if (!tab) return null;

      return {
        left: tab.offsetLeft,
        right: tab.offsetLeft + tab.offsetWidth,
        top: tab.offsetTop,
        height: tab.offsetHeight,
      };
    };

    const draw = () => {
      const { left, right, top, height } = edges.current;

      gsap.set(indicator, {
        x: left,
        y: top,
        width: right - left,
        height,
      });
    };

    const snapTo = (box) => {
      if (edges.current) gsap.killTweensOf(edges.current);
      edges.current = box;
      draw();
    };

    const slideTo = (box) => {
      const isMovingRight = box.left > edges.current.left;

      gsap.to(edges.current, {
        left: box.left,
        top: box.top,
        height: box.height,
        duration: SLIDE_DURATION,
        ease: isMovingRight ? TRAILING_EASE : LEADING_EASE,
      });

      // El onUpdate va en el último tween creado: GSAP los renderiza en
      // orden de creación, así que acá los dos bordes ya avanzaron y la
      // pastilla se dibuja una sola vez por frame con ambos al día.
      gsap.to(edges.current, {
        right: box.right,
        duration: SLIDE_DURATION,
        ease: isMovingRight ? LEADING_EASE : TRAILING_EASE,
        onUpdate: draw,
      });
    };

    const box = measure();
    if (!box) return;

    edges.current ? slideTo(box) : snapTo(box);

    let isInitialObservation = true;

    const observer = new ResizeObserver(() => {
      // observe() dispara un callback al conectarse. Atenderlo abortaría
      // el slide que acaba de arrancar, así que el primero se descarta.
      if (isInitialObservation) {
        isInitialObservation = false;
        return;
      }

      const box = measure();
      if (box) snapTo(box);
    });

    observer.observe(list);

    return () => {
      observer.disconnect();
      gsap.killTweensOf(edges.current);
    };
  }, [activeTab]);

  return { listRef, indicatorRef, registerTab };
};
