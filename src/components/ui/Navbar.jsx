// Hooks
import { useModal } from "@hooks/useModal";
import { useTheme } from "@hooks/useTheme";
import { useScrolled } from "@hooks/useScrolled";
// Data
import { headerSections } from "@data/headerSections";
// Componentes
import Icon from "@components/ui/Icon";
// Modales
import Modal from "@modals/Modal";
import ThemeModal from "@modals/ThemeModal";

export default function Navbar() {
  const { scrolled } = useScrolled();
  const { theme, setTheme } = useTheme();
  const { modalType, isOpen, triggerRef, openModal, closeModal } = useModal();

  return (
    <nav
      className={`w-fit sticky self-center top-3 flex p-2 gap-1 transition-[width,height,shadow] z-10
        md:top-5 md:gap-2
        ${
          scrolled
            ? `border rounded-full border-gray-100/80 backdrop-blur-xs
            dark:border-white/10 dark:shadow-[0px_0px_1.5px_0.1px_#000]`
            : "border-transparent"
        }`}
    >
      {headerSections.map((section) => (
        <a
          key={section.title}
          href={section.url}
          className="py-2 px-3.5 rounded-3xl text-sm text-[#75777E] font-semibold transition-[background-color,padding] duration-300
          hover:bg-gray-200 hover:text-[#1b1b1e] hover:px-6
          dark:text-[#d1d5db] dark:hover:text-white dark:hover:bg-[#28282b]"
        >
          <span>{section.title}</span>
        </a>
      ))}

      <button
        onClick={(e) => {
          e.preventDefault();
          openModal(null, "theme", e.currentTarget);
        }}
        className="ml-1 flex items-center p-2.5 rounded-3xl
        hover:bg-gray-200 hover:cursor-pointer
        md:ml-3
        dark:hover:bg-[#28282b] dark:border-[#1e1e209f]"
      >
        <Icon
          size={18}
          name={
            theme === "system"
              ? "desktop_windows"
              : theme === "dark"
                ? "moon_stars"
                : "wb_sunny"
          }
          className="text-[#75777E]
          dark:text-[#d1d5db]"
        />
      </button>

      {modalType === "theme" && (
        <Modal
          disableHeader
          isOpen={isOpen}
          onClose={closeModal}
          triggerRef={triggerRef}
          growDirection="center-bottom"
          styles="w-40 p-1.5 rounded-4xl"
        >
          <ThemeModal theme={theme} setTheme={setTheme} onClose={closeModal} />
        </Modal>
      )}
    </nav>
  );
}
