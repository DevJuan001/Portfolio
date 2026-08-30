import { useId } from "react";

export default function LiquidGlass({
  children,
  className,
  role,
  disable,
  onClick,
}) {
  const filterId = `liquid-glass-noise-${useId()}`;

  return (
    <>
      {/* SVG filter para la textura líquida */}
      <svg style={{ display: "none" }} xmlns="http://www.w3.org/2000/svg">
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.4"
            numOctaves="3"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0   1 0 0 0 0   1 0 0 0 0   0 0 0 0.04 0"
            in="noise"
          />
        </filter>
      </svg>

      <div
        role={role}
        aria-disabled={disable}
        onClick={onClick}
        className={`relative overflow-hidden shadow-lg shadow-gray-900/4 
        ${className}
        dark:shadow-black/10`}
        style={{
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
        }}
      >
        {/* Base del glass — iridiscencia sutil */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-linear-to-br from-white/4 via-white/2 to-transparent
          dark:from-white/4 dark:via-white/2 dark:to-transparent"
        />

        {/* Textura líquida (noise) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ filter: `url(#${filterId})` }}
        />

        {/* Borde visible — se nota hasta en fondo blanco */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-gray-400/20
          dark:ring-white/8"
        />

        {/* Sutil inner glow para darle cuerpo al glass */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-linear-to-t from-gray-900/2 to-transparent
          dark:from-white/2"
        />

        {/* Contenido */}
        {children}
      </div>
    </>
  );
}
