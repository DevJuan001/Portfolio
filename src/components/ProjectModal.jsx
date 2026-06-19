import { useCarrousel } from "../hooks/useCarrousel";

export default function ProjectModal({ project }) {
  const images = project.images ?? [project.image];
  const { current, goTo } = useCarrousel(images);

  return (
    <div
      className="flex flex-col gap-4
    dark:text-white overflow-y-auto"
    >
      <div
        className="relative max-h-72 flex gap-3 shadow-[0px_0px_0px_0px_#000] overflow-hidden
        md:max-h-[420px]"
      >
        {images.map((image, i) => (
          <div
            key={i}
            className={`h-44 bg-gray-200 rounded-2xl overflow-hidden
            md:h-[390px]
            dark:bg-[#202022] transition-all duration-500        
            ${i === current ? "w-[90%]" : "w-[10%]"}`}
          >
            <img
              data-shared-id="project-main-image"
              src={image}
              alt={project.alt}
              className={`w-full h-full rounded-ss-2xl transition-opacity duration-500 aspect-video
              dark:border-[#000000]
              ${i === current ? "opacity-100" : "opacity-2 dark:opacity-2"}`}
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

      <div className="flex flex-col gap-3 px-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-semibold">Qué hice y por qué?</h2>

          {project.backendExplain && (
            <p className="text-[#75777E] dark:text-[#7e8088]">
              <strong className="text-[#3a3b3d]">Backend:</strong>{" "}
              {project.backendExplain}
            </p>
          )}

          {project.frontendExplain && (
            <p className="text-[#75777E] dark:text-[#7e8088]">
              <strong className="text-[#3a3b3d]">Frontend:</strong>{" "}
              {project.frontendExplain}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
