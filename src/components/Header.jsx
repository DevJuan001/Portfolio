// Hooks
import { useModal } from "../hooks/useModal";
import { useTheme } from "../hooks/useTheme";
// Data
import { headerSections } from "../data/headerSections";
// Componentes
import Icon from "./Icon";
import Modal from "./Modal";
import ThemeModal from "./ThemeModal";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { modalType, isOpen, triggerRef, openModal, closeModal } = useModal();

  return (
    <header
      className="w-full flex items-center justify-center gap-3
      dark:text-white"
    >
      <nav className="mt-4 flex gap-3">
        {headerSections.map((section) => (
          <a
            key={section.title}
            className="py-2 px-4 rounded-3xl text-sm text-[#75777E] font-semibold
            hover:bg-gray-100 hover:text-[#1b1b1e]
            dark:text-[#d1d5db] dark:hover:bg-[#28282b]"
            href={section.url}
          >
            <span>{section.title}</span>
          </a>
        ))}
      </nav>

      <div
        className="mt-4 flex items-center justify-center border-l border-gray-200
        dark:border-[#1e1e209f]"
      >
        <button
          onClick={(e) => openModal(null, "theme", e.currentTarget)}
          className="ml-3 flex items-center p-2 rounded-3xl
          hover:bg-gray-100 hover:cursor-pointer
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
      </div>

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
