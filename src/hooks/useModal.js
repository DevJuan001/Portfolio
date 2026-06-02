import { useState } from "react";

export function useModal() {
  const [modalType, setModalType] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [triggerRef, setTriggerRef] = useState(null);

  const openModal = (data, type, ref = null) => {
    let rect = null;

    if (ref) {
      rect = ref.getBoundingClientRect();
    }

    setModalData(data);
    setModalType(type);
    setIsOpen(true);
    setTriggerRef({ element: ref, rect });
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalData(null);
    setModalType(null);
    setTriggerRef(null);
  };

  return {
    modalType,
    isOpen,
    modalData,
    triggerRef,
    openModal,
    closeModal,
  };
}
