import { useEffect } from "react";
import { useState } from "react";

export function useCarrousel(images) {
  const [current, setCurrent] = useState(0);

  const nextIndex = (current + 1) % images.length;
  const prevIndex = (current - 1 + images.length) % images.length;

  const goTo = (index) => {
    if (index === current) return;
    setCurrent(index);
  };

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      goTo((current + 1) % images.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [current]);

  return { current, nextIndex, prevIndex, goTo };
}
