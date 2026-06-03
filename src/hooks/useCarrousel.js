import { useEffect } from "react";
import { useState } from "react";

export function useCarrousel(images) {
  const [current, setCurrent] = useState(0);
  const [slideAnim, setSlideAnim] = useState("animate-slide-in-right");

  const goTo = (index) => {
    if (index === current) return;
    setSlideAnim(
      index > current ? "animate-slide-in-right" : "animate-slide-in-left",
    );
    setCurrent(index);
  };

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      goTo((current + 1) % images.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [current]);

  return { current, slideAnim, goTo };
}
