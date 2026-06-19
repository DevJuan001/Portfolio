// Hooks
import { useModal } from "../hooks/useModal";
// Icons
import { icons } from "../assets/icons";
// Componentes
import Icon from "./Icon";
// Modales
import Modal from "./Modal";
import ProjectModal from "./ProjectModal";

export default function ProjectItem({ project }) {
  const { modalType, modalData, isOpen, triggerRef, openModal, closeModal } =
    useModal();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        openModal(project, project.title, e.currentTarget);
      }}
      className="flex flex-col gap-3 rounded-3xl p-3 transition-colors duration-200
      hover:bg-[#e5e7eb70] hover:cursor-pointer
      dark:bg-[#101012] dark:hover:bg-[#202022]"
    >
      <div
        className="relative h-44 rounded-2xl shadow-md overflow-hidden
        md:h-[275px]"
      >
        <img src={project.images[0]} alt={project.alt} />

        <button
          onClick={(e) => {
            e.stopPropagation();
            openModal(project, project.title, e.currentTarget);
          }}
          className="absolute top-2 right-2 flex items-center p-2 backdrop-blur-xs shadow-[0px_0px_5px_1px_#6a7282] rounded-3xl
          hover:backdrop-blur-sm"
        >
          <Icon name={"expand_content"} color={"#fff"} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-2xl font-semibold dark:text-gray-100">
          {project.title}
        </h3>

        <div className="flex flex-wrap gap-2">
          {project.stack.map((technology) => (
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

        <p className="text-[#75777E] dark:text-[#7e8088]">
          {project.description}
        </p>

        <div className="flex gap-4 mt-2">
          {project.github && (
            <a
              target="_blank"
              href={project.github}
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

          {project.link && (
            <a
              target="_blank"
              href={project.link}
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
          {modalType === "Parking SAAS — Sistema de gestión de parqueaderos" && <ProjectModal project={modalData} />}
        </Modal>
      )}
    </div>
  );
}
