import Icon from "./Icon";
import { icons } from "../assets/icons";
import { useModal } from "../hooks/useModal";
import Modal from "./Modal";
import ProjectModal from "./ProjectModal";

export default function ProjectItem({
  images,
  alt,
  title,
  shortDescription,
  description,
  github,
  link,
  stack,
}) {
  const { modalType, modalData, isOpen, triggerRef, openModal, closeModal } =
    useModal();

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        openModal(
          {
            images,
            alt,
            title,
            shortDescription,
            description,
            github,
            link,
            stack,
          },
          title,
          e.currentTarget,
        );
      }}
      className="flex flex-col gap-3 rounded-3xl p-4 transition-colors duration-200
      hover:bg-[#e5e7eb70] hover:cursor-pointer
      dark:bg-[#101012] dark:hover:bg-[#202022]"
    >
      <div
        className="h-44 bg-gray-200 p-3 rounded-2xl overflow-hidden
        md:h-[275px]
        dark:bg-[#28282b]"
      >
        <img
          src={images[0]}
          alt={alt}
          className="ml-3 h-[165px] border-l-4 border-t-4 border-gray-300 rounded-ss-2xl
          md:ml-5 md:w-full md:h-[275px]
          dark:border-[#101012]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold dark:text-gray-100">{title}</h3>

        <div className="flex flex-wrap gap-2">
          {stack.map((technology) => (
            <div
              key={technology.name}
              className={`flex items-center gap-1 py-1 px-2.5 rounded-full 
                ${technology.styles}
              `}
            >
              <technology.icon className="w-3.5 h-3.5" />

              <span className="text-xs font-medium">{technology.name}</span>
            </div>
          ))}
        </div>

        <p className="text-[#75777E] dark:text-[#7e8088]">{shortDescription}</p>

        <div className="flex gap-4 mt-2">
          {github && (
            <a
              target="_blank"
              href={github}
              className="flex items-center gap-2 py-2 px-4 border border-[#c5c6ce] rounded-3xl transition-colors duration-200 group
                hover:bg-black hover:cursor-pointer hover:text-white
                dark:text-white dark:border-[#3a3d43] dark:hover:bg-white dark:hover:text-black"
            >
              <icons.githubLight
                className="w-5 h-5 transition-all duration-200 
                dark:invert dark:group-hover:invert-0
                group-hover:invert"
              />

              <span>Github</span>
            </a>
          )}

          {link && (
            <a
              target="_blank"
              href={link}
              className="flex items-center gap-2 py-2 px-4 border border-[#c5c6ce] rounded-3xl transition-colors duration-200 group
              hover:bg-black hover:cursor-pointer hover:text-white
              dark:text-white dark:border-[#3a3d43] dark:hover:bg-white dark:hover:text-black"
            >
              <Icon name={"open_in_new"} size={16} />

              <span>Ver</span>
            </a>
          )}
        </div>
      </div>

      {modalType && (
        <Modal
          isOpen={isOpen}
          type="project"
          location="center"
          triggerRef={triggerRef}
          onClose={closeModal}
        >
          {modalType === "Tracklinker" && <ProjectModal project={modalData} />}
        </Modal>
      )}
    </div>
  );
}
