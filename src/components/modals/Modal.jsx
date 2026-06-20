import Icon from "../ui/Icon";
import { createPortal } from "react-dom";
import React, { useRef, useId } from "react";
import { useFlipModal } from "../../hooks/useFlipModal";
import { modal_styles } from "../../data/modalStyles";

export default function Modal({
  isOpen,
  type,
  triggerRef,
  z_index = "50",
  location = "anchored",
  growDirection = "bottom-right",
  margin = 20,
  title,
  children,
  onClose,
  disableClose = false,
}) {
  const modalRef = useRef();
  const contentRef = useRef();
  const overlayRef = useRef();

  const id = useId();
  const modalId = id.replace(/:/g, "");

  if (type === "user" || type === "help") {
    location = "center";
  }

  if (type === "filter") {
    growDirection = "bottom-center";
  }

  const { closeModal } = useFlipModal({
    isOpen,
    modalRef,
    contentRef,
    triggerRef,
    overlayRef,
    onClose,
    location,
    growDirection,
    margin,
    id: modalId,
  });

  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      // Si el hijo es otro Modal o un componente que ya maneja su propio isOpen/onClose,
      // evitamos sobreescribir su onClose para no cerrar el padre accidentalmente.
      if (child.props.isOpen !== undefined) return child;

      return React.cloneElement(child, { onClose: closeModal });
    }
    return child;
  });

  return createPortal(
    <section
      ref={overlayRef}
      style={{ zIndex: z_index }}
      className="fixed inset-0"
      onClick={(e) => {
        if (e.target === e.currentTarget && !disableClose) closeModal(e);
      }}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        style={{
          visibility: "hidden",
          maxHeight: "calc(100vh - 20px)",
          overflowY: "auto",
        }}
        ref={modalRef}
        className={`${modal_styles[type] ?? modal_styles.default} bg-[#fbf9fc] shadow-lg
        dark:border-4 dark:bg-black dark:border-[#1e1e209f]`}
      >
        <div ref={contentRef}>
          {type !== "theme" && (
            <header className="flex justify-between items-center mb-2">
              <span
                data-shared-id="modal-title"
                className="min-w-56 font-medium text-lg dark:text-[#e4e2e5]"
              >
                {title}
              </span>

              <button
                onClick={closeModal}
                className="w-10 h-10 p-2.5 self-end flex items-center justify-center rounded-full
                hover:bg-[#49454f21] hover:cursor-pointer
                dark:hover:bg-[#28282bbd]"
              >
                <Icon name={"close"} size={24} className="dark:invert" />
              </button>
            </header>
          )}

          {enhancedChildren}
        </div>
      </section>
    </section>,
    document.getElementById("modal-root"),
  );
}
