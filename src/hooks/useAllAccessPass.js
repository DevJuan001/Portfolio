import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";
import { createSpring } from "@utils/spring";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const BUBBLE_HEIGHT = 56;

const moveBubble = ({ x, alpha }, element) => {
  element.style.transform = `translate3d(${x}px, 0, 0)`;
  element.style.setProperty("--alpha", alpha);
};

const sizeBackground = ({ width, height, scale }, element) => {
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.transform = `translate(-50%, -50%) scale(${scale})`;
};

export function useAllAccessPass({ triggerRef }) {
  const barRef = useRef(null);
  const blobRef = useRef(null);
  const dotBubbleRef = useRef(null);
  const dotBackgroundRef = useRef(null);
  const playBubbleRef = useRef(null);
  const playBackgroundRef = useRef(null);
  const dotsRef = useRef([]);

  const registerDot = (index) => (node) => {
    dotsRef.current[index] = node;
  };

  useLayoutEffect(() => {
    const bar = barRef.current;
    const blob = blobRef.current;
    const dotBubble = dotBubbleRef.current;
    const playBubble = playBubbleRef.current;
    const trigger = triggerRef.current;
    if (!bar || !blob || !dotBubble || !playBubble || !trigger) return;

    // Measure with the active dot already expanded, or the pill lands on
    // the collapsed width and the progress track spills out of it.
    dotBubble.style.setProperty("--progress-intro", 1);
    const dotWidth = dotBubble.offsetWidth;
    const playWidth = playBubble.offsetWidth;
    const barCenter = bar.offsetWidth / 2;
    const centerOffset = (bubble) =>
      barCenter - (bubble.offsetLeft + bubble.offsetWidth / 2);

    const barSpring = createSpring(
      bar,
      { y: { position: 180, stiffness: 100, damping: 8 } },
      ({ y }, element) => {
        element.style.transform = `translate3d(0, ${y}px, 0)`;
      },
    );

    const blobSpring = createSpring(
      blob,
      {
        x: { position: -15, stiffness: 100, damping: 8 },
        width: { position: 30, stiffness: 100, damping: 8 },
        height: { position: 80, stiffness: 100, damping: 8 },
        scale: { position: 1.3, duration: 0.5, bounce: 0 },
      },
      ({ x, width, height, scale }, element) => {
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        element.style.transform = `translate3d(${x}px, ${-height / 2}px, 0) scale(${scale})`;
      },
    );

    const dotElementSpring = createSpring(
      dotBubble,
      {
        x: { position: centerOffset(dotBubble), stiffness: 100, damping: 20 },
        alpha: { position: 0, stiffness: 100, damping: 20 },
      },
      moveBubble,
    );

    const playElementSpring = createSpring(
      playBubble,
      {
        x: { position: centerOffset(playBubble), stiffness: 100, damping: 20 },
        alpha: { position: 0, stiffness: 100, damping: 20 },
      },
      moveBubble,
    );

    const dotBackgroundSpring = createSpring(
      dotBackgroundRef.current,
      {
        width: { position: 40, stiffness: 100, damping: 10 },
        height: { position: 36, stiffness: 100, damping: 10 },
        scale: { position: 1.3, duration: 0.3, bounce: 0 },
      },
      sizeBackground,
    );

    const playBackgroundSpring = createSpring(
      playBackgroundRef.current,
      {
        width: { position: 80, stiffness: 100, damping: 10 },
        height: { position: 36, stiffness: 100, damping: 10 },
        scale: { position: 0, duration: 0.3, bounce: 0 },
      },
      sizeBackground,
    );

    const introSpring = createSpring(
      dotBubble,
      { progressIntro: { position: 0, stiffness: 200, damping: 20 } },
      ({ progressIntro }, element) => {
        element.style.setProperty("--progress-intro", progressIntro);
      },
    );

    const dotSprings = dotsRef.current
      .filter(Boolean)
      .map((dot) =>
        createSpring(
          dot,
          { x: { position: 36, stiffness: 100, damping: 20 } },
          ({ x }, element) => {
            element.style.transform = `translate3d(${x}px, 0, 0)`;
          },
        ),
      );

    const springs = [
      barSpring,
      blobSpring,
      dotElementSpring,
      playElementSpring,
      dotBackgroundSpring,
      playBackgroundSpring,
      introSpring,
      ...dotSprings,
    ];

    const calls = [];

    const cleanup = () => {
      calls.forEach((call) => call.kill());
      springs.forEach((spring) => spring.destroy());
    };

    if (prefersReducedMotion()) {
      barSpring.snap("y", 0);
      [dotElementSpring, playElementSpring].forEach((spring) => {
        spring.snap("x", 0);
        spring.snap("alpha", 1);
      });
      dotBackgroundSpring.snap("width", dotWidth);
      playBackgroundSpring.snap("width", playWidth);
      [dotBackgroundSpring, playBackgroundSpring].forEach((spring) => {
        spring.snap("height", BUBBLE_HEIGHT);
        spring.snap("scale", 1);
      });
      introSpring.snap("progressIntro", 1);
      dotSprings.forEach((spring) => spring.snap("x", 0));
      bar.dataset.activated = "true";

      return cleanup;
    }

    const at = (delay, callback) => calls.push(gsap.delayedCall(delay, callback));

    const play = () => {
      bar.dataset.activated = "true";
      blob.style.opacity = "1";

      at(0, () => blobSpring.setTarget("scale", 0.8));
      at(0.03, () => barSpring.setTarget("y", 0));
      at(0.05, () => {
        blobSpring.setTarget("x", -BUBBLE_HEIGHT / 2);
        blobSpring.setTarget("width", BUBBLE_HEIGHT);
      });
      at(0.15, () => blobSpring.setTarget("height", BUBBLE_HEIGHT));
      at(0.3, () => dotBackgroundSpring.setTarget("scale", 1));
      at(0.5, () => {
        dotElementSpring.setTarget("x", 0);
        dotBackgroundSpring.setTarget("width", dotWidth);
      });
      at(0.52, () => {
        blob.style.opacity = "0";
      });
      at(0.54, () => {
        playElementSpring.setTarget("x", 0);
        playBackgroundSpring.setTarget("scale", 1);
      });
      at(0.7, () => {
        dotBackgroundSpring.setTarget("height", BUBBLE_HEIGHT);
        playBackgroundSpring.setTarget("width", playWidth);
        playBackgroundSpring.setTarget("height", BUBBLE_HEIGHT);
      });
      dotSprings.forEach((spring, index) =>
        at(0.74 + 0.02 * index, () => {
          spring.setTarget("x", 0);
          if (index === 0) introSpring.setTarget("progressIntro", 1);
        }),
      );
      at(1, () => {
        dotElementSpring.setTarget("alpha", 1);
        playElementSpring.setTarget("alpha", 1);
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.disconnect();
        play();
      },
      { threshold: 0.6 },
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
      cleanup();
    };
  }, [triggerRef]);

  return {
    barRef,
    blobRef,
    dotBubbleRef,
    dotBackgroundRef,
    playBubbleRef,
    playBackgroundRef,
    registerDot,
  };
}
