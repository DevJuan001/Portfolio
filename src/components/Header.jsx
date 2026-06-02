import { headerSections } from "../data/headerSections";

export default function Header() {
  return (
    <header
      className="w-full flex items-center justify-center
    dark:text-white"
    >
      <nav className="mt-4 flex gap-4">
        {headerSections.map((section) => (
          <a href={section.url} key={section.title}>
            <span>{section.title}</span>
          </a>
        ))}
      </nav>
    </header>
  );
}
