// Componentes
import Icon from "../ui/Icon";

export default function ProjectModal({ project }) {
  const images = project?.images ?? [project?.image];

  return (
    <div
      className="flex flex-col items-center justify-center mt-2 gap-12
      dark:text-white"
    >
      <div
        className="w-7xl h-32 flex items-center justify-center gap-3 shadow-[0px_0px_0px_0px_#000]
        md:h-44
        lg:h-[200px]
        xl:h-[230px]
        2xl:h-[235px]"
      >
        {images.map((image, index) => (
          <img
            {...(index === 0 && { "data-shared-id": "project-main-image" })}
            src={image}
            alt={project.alt}
            className={`w-auto h-full rounded-2xl object-cover
            dark:border-[#000000]`}
          />
        ))}
      </div>

      <div className="w-7xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={project.icon} alt="" className="h-14 w-14" />

            <h2
              data-shared-id="project-title"
              className="text-3xl font-semibold
              dark:text-gray-100"
            >
              {project?.title}
            </h2>
          </div>

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
        </div>

        {project?.objective && (
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Objetivo</h2>

            <p
              className="text-black/70
              dark:text-[#F1F1F1]"
            >
              {project?.objective}
            </p>

            {project?.objectiveModules.map((module) => (
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

        {project?.technicalDecisions && (
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">Decisiones técnicas</h2>

            <ul className="pl-6 list-disc">
              {project?.technicalDecisions?.map((item, index) => (
                <li
                  key={index}
                  className="mb-2 text-black/70
                  dark:text-[#F1F1F1]"
                >
                  <strong>{item?.title}</strong> {item?.explain}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
