// Hooks
import { useModal } from "@hooks/useModal";
// Data
import { technologies } from "@data/technologies";
// Componentes
import Icon from "@components/ui/Icon";
// Modales
import ProjectModal from "@modals/ProjectModal";

export default function ProjectItem({ project, reversed = false }) {
  const { modalType, modalData, isOpen, triggerRef, openModal, closeModal } =
    useModal();

  return (
    <div
      onClick={(e) => openModal(project, project.title, e.currentTarget)}
      className={`relative w-full flex flex-col items-center gap-3 p-2.5 rounded-4xl transition-colors duration-200 group
      ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"}
      hover:bg-[#F5F3F6] hover:cursor-pointer
      focus-within:shadow-[0_0_3px_2px_#e5e7eb]
      dark:hover:bg-[#101012] dark:focus-within:shadow-[0_0_3px_3px_#28282b]`}
    >
      <img
        data-shared-id="project-main-image"
        src={project.images[0]}
        alt={project.alt}
        width={1919}
        height={1078}
        className="w-full rounded-[22px] object-cover
        lg:w-1/2 lg:h-80"
      />

      <div
        className="w-full flex flex-col gap-2 pl-3
        lg:w-1/2 lg:p-5"
      >
        <div className="flex items-center gap-2">
          <h3
            data-shared-id="project-title"
            className="text-4xl font-dmsans font-semibold
            dark:text-[#E4E2E5]"
          >
            {project.title}
          </h3>

          <Icon
            name="arrow_outward"
            size={22}
            className="shrink-0 text-[#75777E] transition-transform duration-200
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
            dark:text-[#7E8088]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {project.stack.map((name) => {
            const technology = technologies[name];

            return (
              <div
                key={name}
                className={`flex items-center gap-1 py-1 px-2.5 rounded-full ${technology.styles}`}
              >
                <technology.icon className="w-3.5 h-3.5" />

                <span className="text-xs font-medium">{technology.name}</span>
              </div>
            );
          })}
        </div>

        <p
          className="text-[#75777E]
          dark:text-[#7E8088]"
        >
          {project.description}
        </p>
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
