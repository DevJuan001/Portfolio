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
            className={`h-44 bg-gray-200 px-3 pt-4 rounded-2xl overflow-hidden
            md:h-[390px]
            dark:bg-[#202022] transition-all duration-500        
            ${i === current ? "w-[90%]" : "w-[10%]"}`}
          >
            <img
              src={image}
              alt={project.alt}
              className={`ml-1 w-full h-full border-l-4 border-t-4 border-gray-300 rounded-ss-2xl transition-opacity duration-500
              md:ml-10
              dark:border-[#000000]
              ${i === current ? "opacity-100" : "opacity-2 dark:opacity-2"}`}
            />
          </div>
        ))}

        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center">
          <div
            className="h-10 flex gap-2 px-3 py-4 rounded-3xl backdrop-blur-md shadow-[0px_0px_1px_0.01px_#28282b8c] animate-carrousel-sections-in
            dark:backdrop-blur-sm dark:shadow-[0px_0px_5px_0.01px_#28282b8c]"
          >
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={`h-2 rounded-3xl transition-all duration-500 shadow-[0px_0px_6px_0.01px_#28282b8c]
                ${index === current ? "w-8 bg-white dark:bg-[#28282b]" : "w-2 bg-[#ffffff5c] dark:bg-[#28282b8c]"}
                hover:cursor-pointer
              `}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <div className="flex flex-col gap-2 max-w-3xl">
          <h2 className="text-4xl font-semibold">{project.title}</h2>

          <p className="text-lg text-[#75777E] dark:text-[#7e8088]">
            {project.description}
          </p>
        </div>
      </div>
    </div>
  );
}
