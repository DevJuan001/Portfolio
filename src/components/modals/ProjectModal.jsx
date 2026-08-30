// Componentes
import Icon from "@components/ui/Icon";
import Modal from "./Modal";

export default function ProjectModal({ isOpen, triggerRef, onClose, project }) {
  const images = project.images ?? [project.image];

  return (
    <Modal
      margin={0}
      dragToClose
      responsive
      isOpen={isOpen}
      onClose={onClose}
      triggerRef={triggerRef}
      styles="w-screen h-screen flex flex-col items-center p-7 font-sans"
    >
      <div
        className="w-full flex flex-col items-center justify-center mt-2 gap-12
        xl:w-300
        dark:text-white"
      >
        <div className="w-full flex flex-wrap items-start gap-3">
          {images.map((image, index) => (
            <img
              key={image}
              {...(index === 0 && { "data-shared-id": "project-main-image" })}
              src={image}
              alt={project.alt}
              width={1919}
              height={1078}
              className={`min-w-0 grow basis-80 rounded-2xl object-cover
              dark:border-[#000000]`}
            />
          ))}
        </div>

        <div
          className="w-full flex flex-col gap-8
          md:px-4"
        >
          <div
            className="flex flex-col justify-between gap-2
            sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-3">
              <img
                src={project.icon}
                alt={`Logo del proyecto ${project.title}`}
                className="h-14 w-14"
              />

              <h2
                data-shared-id="project-title"
                className="text-4xl font-semibold font-dmsans
                dark:text-gray-100"
              >
                {project.title}
              </h2>
            </div>

            {project.link && (
              <a
                target="_blank"
                data-shared-id="open-project-button"
                href={project.link}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-black text-white border border-[#c5c6ce] rounded-3xl transition-colors group
                sm:w-fit
                hover:bg-black/85 hover:cursor-pointer
                dark:bg-white dark:text-black dark:border-[#3a3d43] dark:hover:bg-neutral-200"
              >
                <Icon name={"open_in_new"} size={16} />

                <span>Abrir</span>
              </a>
            )}
          </div>

          {project.objective && (
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold">Objetivo</h2>

              <p
                className="text-black/70
                dark:text-[#F1F1F1]"
              >
                {project.objective}
              </p>

              {project.objectiveModules.map((module) => (
                <div
                  key={module.title}
                  className="text-black/70
                  dark:text-[#F1F1F1]"
                >
                  <span>{module.title}</span>

                  <ul>
                    {module.items.map((item, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <Icon name={"check_small"} size={14} />

                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="w-full flex flex-wrap gap-2">
            {project.features.map((feature, index) => (
              <div
                key={index}
                className="flex flex-1 basis-92 gap-2 p-6 bg-[#F5F3F6] rounded-4xl
                md:h-66"
              >
                <div className="h-fit flex items-center justify-center p-2 bg-[#E4E2E5] rounded-full">
                  <Icon name={feature.icon} fill />
                </div>

                <div className="w-full flex flex-col mt-1 gap-1">
                  <span className="text-2xl font-medium">{feature.title}</span>

                  <span>{feature.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="w-full flex flex-col gap-2">
            <span className="text-2xl font-semibold">Decisiones tecnicas</span>

            {project.technicalDecisions.map((technicalDecision, index) => (
              <div key={index} className="w-full">
                <span className="font-medium">{technicalDecision.title} </span>

                <span className="text-[#75777E]">
                  {technicalDecision.explain}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
