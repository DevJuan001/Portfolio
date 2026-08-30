// Hooks
import { useModal } from "@hooks/useModal";
// Icons
import { icons } from "@assets/icons";
// Componentes
import Icon from "@components/ui/Icon";
// Modales
import ProjectModal from "@modals/ProjectModal";

export default function ProjectItem({ project }) {
  const { modalType, modalData, isOpen, triggerRef, openModal, closeModal } =
    useModal();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        openModal(project, project.title, e.currentTarget);
      }}
      className="flex flex-col items-center gap-3 p-2.5 rounded-4xl transition-colors
      lg:flex-row
      hover:bg-[#F5F3F6] hover:cursor-pointer
      dark:hover:bg-[#101012]"
    >
      <img
        data-shared-id="project-main-image"
        src={project.images[0]}
        alt={project.alt}
        className="h-full w-full rounded-[22px]
        lg:h-80"
      />

      <div
        className="flex flex-col gap-2 pl-3
        lg:p-5"
      >
        <h3
          data-shared-id="project-title"
          className="text-3xl font-semibold
          dark:text-gray-100"
        >
          {project.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
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

        <p
          className="text-[#75777E] 
          dark:text-[#7e8088]"
        >
          {project.description}
        </p>

        <div className="flex gap-3 mt-2">
          {project.link && (
            <a
              target="_blank"
              data-shared-id="open-project-button"
              href={project.link}
              className="flex items-center gap-2 py-2 px-4 bg-black text-white border border-[#c5c6ce] rounded-3xl transition-colors duration-200 group
              hover:bg-black/85 hover:cursor-pointer
              dark:bg-white dark:text-black dark:border-[#3a3d43] dark:hover:bg-neutral-200"
            >
              <Icon name={"open_in_new"} size={16} />

              <span>Abrir</span>
            </a>
          )}

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
        </div>
      </div>

      {modalType === project.title && (
        <ProjectModal
          isOpen={isOpen}
          project={modalData}
          triggerRef={triggerRef}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
