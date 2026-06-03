// Hooks
import { useModal } from "../hooks/useModal";
import { useTheme } from "../hooks/useTheme";
import { useScrolled } from "../hooks/useScrolled";
// Data
import { headerSections } from "../data/headerSections";
// Componentes
import Icon from "./Icon";
import Modal from "./Modal";
import ThemeModal from "./ThemeModal";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { scrolled } = useScrolled();
  const { modalType, isOpen, triggerRef, openModal, closeModal } = useModal();

  return (
    <header
      className="w-full sticky z-10 top-0 flex items-center justify-center gap-3
      dark:text-white"
    >
      <nav
        className={`my-4 flex gap-3 p-2
        ${
          scrolled
            ? "border rounded-full border-gray-200 dark:border-white/10 backdrop-blur-xs"
            : "border-transparent"
        }`}
      >
        {headerSections.map((section) => (
          <a
            key={section.title}
            className="py-2 px-4 rounded-3xl text-sm text-[#75777E] font-semibold
            hover:bg-gray-200 hover:text-[#1b1b1e]
            dark:text-[#d1d5db] dark:hover:text-white dark:hover:bg-[#28282b]"
            href={section.url}
          >
            <span>{section.title}</span>
          </a>
        ))}

        <button
          onClick={(e) => openModal(null, "theme", e.currentTarget)}
          className="ml-3 flex items-center p-2.5 rounded-3xl
          hover:bg-gray-200 hover:cursor-pointer
          dark:hover:bg-[#28282b] dark:border-[#1e1e209f]"
        >
          <Icon
            name={
              theme === "system"
                ? "desktop_windows"
                : theme === "dark"
                  ? "moon_stars"
                  : "wb_sunny"
            }
            size={18}
          />
        </button>
      </nav>

      {modalType === "theme" && (
        <Modal
          isOpen={isOpen}
          type={"theme"}
          triggerRef={triggerRef}
          growDirection="center-bottom"
          onClose={closeModal}
        >
          <ThemeModal theme={theme} setTheme={setTheme} onClose={closeModal} />
        </Modal>
      )}
    </header>
  );
}
