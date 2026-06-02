import "material-symbols/rounded.css";

export default function Icon({
  name,
  fill = false,
  weight = 400,
  size = 24,
  color,
  className,
}) {
  return (
    <span
      className={`material-symbols-rounded ${className ?? ""}`}
      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' var(--icon-weight, ${weight}), 'GRAD' 0, 'opsz' ${size}`,
        fontSize: size,
        color,
      }}
    >
      {name}
    </span>
  );
}
