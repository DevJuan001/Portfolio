// Hooks
import { createPortal } from "react-dom";
import React, { useRef, useId } from "react";
import { useFlipModal } from "@hooks/useFlipModal";
// Componentes
import Icon from "@components/ui/Icon";
import LiquidGlass from "@components/ui/LiquidGlass";

export default function Modal({
  isOpen,
  styles,
  triggerRef,
  z_index = "50",
  location = "anchored",
  growDirection = "bottom-right",
  margin = 20,
  title,
  children,
  onClose,
  disableClose = false,
  disableHeader,
  dragToClose = false,
  responsive = false,
}) {
  const modalRef = useRef();
  const contentRef = useRef();
  const overlayRef = useRef();

  const id = useId();
  const modalId = id.replace(/:/g, "");

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "clip";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const { closeModal } = useFlipModal({
    isOpen,
    modalRef,
    contentRef,
    triggerRef,
    overlayRef,
    onClose,
    location: location,
    growDirection: growDirection,
    margin,
    id: modalId,
    dragToClose,
    responsive,
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
          maxHeight: "100vh",
        }}
        ref={modalRef}
        className={`flex flex-col bg-[#fbf9fc] shadow-lg ${
          styles ??
          `p-7 w-100 rounded-4xl
          md:w-125`
        }
        dark:border-2 dark:bg-black dark:border-[#1e1e209f]`}
      >
        <div ref={contentRef} className="overflow-y-auto flex-1 p-0.5">
          {!disableHeader && (
            <header className="w-full flex justify-between items-center mb-2 shrink-0">
              <span
                className="min-w-56 text-lg font-medium font-poppins
                dark:text-[#e4e2e5]"
              >
                {title}
              </span>

              <LiquidGlass
                onClick={closeModal}
                className="p-2.5 self-end flex items-center justify-center rounded-full
                hover:bg-[#49454f09] hover:cursor-pointer
                dark:hover:bg-[#28282bbd]"
              >
                <Icon
                  name={"close"}
                  size={24}
                  className="text-[#75777E]
                  dark:text-[#7E8088]"
                />
              </LiquidGlass>
            </header>
          )}

          {enhancedChildren}
        </div>
      </section>
    </section>,
    document.getElementById("modal-root"),
  );
}
