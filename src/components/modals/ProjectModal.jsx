// Hooks
import { useCarrousel } from "../../hooks/useCarrousel";
// Icons
import { icons } from "../../assets/icons";
// Componentes
import Icon from "../ui/Icon";

export default function ProjectModal({ project }) {
  const images = project?.images ?? [project?.image];
  const { current, goTo } = useCarrousel(images);

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 overflow-y-auto
      dark:text-white"
    >
      <div
        className="relative max-h-80 flex items-center justify-center gap-3 shadow-[0px_0px_0px_0px_#000] overflow-hidden
        md:max-h-[700px] md:w-4xl"
      >
        {images.map((image, i) => (
          <div
            key={i}
            className={`h-44 bg-gray-200 rounded-2xl
            md:h-[390px]
            dark:bg-[#202022] transition-all duration-500        
            ${i === current ? "w-[90%]" : "w-[10%]"}`}
          >
            <img
              onClick={() => goTo(i)}
              data-shared-id="project-main-image"
              src={image}
              alt={project.alt}
              className={`w-full h-full rounded-2xl transition-opacity duration-500 aspect-video
                hover:cursor-pointer
                dark:border-[#000000]
                ${i === current ? "opacity-100" : "opacity-1.5 dark:opacity-1"}`}
            />
          </div>
        ))}

        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center">
          <div
            className="h-10 flex gap-2 px-3 py-4 rounded-3xl backdrop-blur-md shadow-[0px_0px_5px_0.1px_#28282b67] animate-carrousel-sections-in
            dark:backdrop-blur-sm dark:shadow-[0px_0px_5px_0.05px_#28282b8c]"
          >
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={`h-2 rounded-3xl transition-all duration-500 shadow-[0px_0px_6px_0.01px_#28282b8c]
                hover:cursor-pointer
                ${index === current ? "w-8 bg-white dark:bg-[#28282b]" : "w-2 bg-[#ffffff5c] dark:bg-[#28282b8c]"}
              `}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="w-full flex flex-col gap-4 px-2
        md:w-4xl"
      >
        <h2
          data-shared-id="project-title"
          className="text-3xl font-semibold
          dark:text-gray-100"
        >
          {project?.title}
        </h2>

        {project?.objective && (
          <div className="w-full flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Reto</h2>

            <p
              className="text-black/70
              dark:text-[#F1F1F1]"
            >
              {project?.challenge}
            </p>
          </div>
        )}

        {project?.objective && (
          <div className="w-full flex flex-col gap-2">
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
          <div className="w-full flex flex-col gap-3">
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

      {project.link && (
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
                  group-hover:invert
                  dark:invert dark:group-hover:invert-0"
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
      )}
    </div>
  );
}
