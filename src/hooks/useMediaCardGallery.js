import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SCROLL_SETTLE_DELAY = 120;

const writeProgress = (list, value) => {
  list?.style.setProperty("--autoplay-progress", value);
};

const walkProgress = (progress, list, index) => {
  gsap.killTweensOf(progress);

  if (prefersReducedMotion()) {
    progress.value = index;
    writeProgress(list, index);
    return;
  }

  gsap.to(progress, {
    value: index,
    duration: 0.5,
    ease: "power1.inOut",
    onUpdate: () => writeProgress(list, progress.value),
  });
};

const scrollToCard = (scroller, card) => {
  if (!scroller || !card) return;

  scroller.scrollTo({
    left: card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2,
    behavior: prefersReducedMotion() ? "instant" : "smooth",
  });
};

const findNearestCard = (scroller, cards) => {
  const center = scroller.scrollLeft + scroller.clientWidth / 2;

  return cards.reduce(
    (nearest, card, index) => {
      if (!card) return nearest;

      const distance = Math.abs(
        card.offsetLeft + card.offsetWidth / 2 - center,
      );
      return distance < nearest.distance ? { index, distance } : nearest;
    },
    { index: 0, distance: Infinity },
  ).index;
};

export function useMediaCardGallery({ cards, revealCards = true }) {
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState(() =>
    prefersReducedMotion() ? "paused" : "playing",
  );
  const [isInView, setIsInView] = useState(false);

  const scrollerRef = useRef(null);
  const dotListRef = useRef(null);
  const cardsRef = useRef([]);
  const progressRef = useRef({ value: 0 });
  const targetRef = useRef(0);
  const hasEnteredRef = useRef(false);

  const registerCard = (index) => (node) => {
    cardsRef.current[index] = node;
  };

  useLayoutEffect(() => {
    const progress = progressRef.current;
    writeProgress(dotListRef.current, progress.value);

    return () => gsap.killTweensOf(progress);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let timeout;

    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const nearest = findNearestCard(scroller, cardsRef.current);
        if (nearest === targetRef.current) return;

        targetRef.current = nearest;
        walkProgress(progressRef.current, dotListRef.current, nearest);
        setCurrent(nearest);
      }, SCROLL_SETTLE_DELAY);
    };

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.35 },
    );

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    observer.observe(scroller);

    return () => {
      clearTimeout(timeout);
      scroller.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const nodes = cardsRef.current.filter((node) => node?.isConnected);

    if (!revealCards || !scroller || !nodes.length || prefersReducedMotion())
      return;

    const reveal = () =>
      gsap.fromTo(
        nodes,
        { y: 30, filter: "blur(16px)", opacity: 0 },
        {
          y: 0,
          filter: "blur(0px)",
          opacity: 1,
          duration: 0.5,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "transform,filter,opacity",
        },
      );

    if (hasEnteredRef.current) {
      reveal();
      return () => gsap.killTweensOf(nodes);
    }

    gsap.set(nodes, { y: 30, filter: "blur(16px)", opacity: 0 });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.disconnect();
        hasEnteredRef.current = true;
        reveal();
      },
      { threshold: 0.25 },
    );

    observer.observe(scroller);

    return () => {
      observer.disconnect();
      gsap.killTweensOf(nodes);
    };
  }, [cards, revealCards]);

  const goTo = (index) => {
    targetRef.current = index;
    setCurrent(index);
    walkProgress(progressRef.current, dotListRef.current, index);
    scrollToCard(scrollerRef.current, cardsRef.current[index]);
    if (status === "ended") setStatus("playing");
  };

  const advance = () => {
    if (current >= cards.length - 1) {
      setStatus("ended");
      return;
    }

    goTo(current + 1);
  };

  const toggle = () => {
    if (status === "ended") {
      goTo(0);
      return;
    }

    setStatus(status === "playing" ? "paused" : "playing");
  };

  const reset = () => {
    gsap.killTweensOf(progressRef.current);
    progressRef.current.value = 0;
    writeProgress(dotListRef.current, 0);
    targetRef.current = 0;
    setCurrent(0);
    scrollerRef.current?.scrollTo({ left: 0, behavior: "instant" });
    if (status === "ended") setStatus("playing");
  };

  return {
    current,
    status,
    isRunning: status === "playing" && isInView,
    scrollerRef,
    dotListRef,
    registerCard,
    goTo,
    advance,
    toggle,
    reset,
  };
}
