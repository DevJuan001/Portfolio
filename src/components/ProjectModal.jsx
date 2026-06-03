import { useCarrousel } from "../hooks/useCarrousel";

export default function ProjectModal({ project }) {
  const images = project.images ?? [project.image];
  const { current, goTo } = useCarrousel(images);

  return (
    <div
      className="flex flex-col gap-4
      dark:text-white overflow-y-auto"
    >
      <div className="relative flex gap-3 shadow-[0px_0px_0px_0px_#000] overflow-hidden">
        {images.map((image, i) => (
          <div
            className={` bg-gray-200 p-3 rounded-2xl overflow-hidden
            dark:bg-[#28282b] transition-all duration-500          
            ${i === current ? "w-[90%]" : "w-[10%]"}`}
          >
            <img
              src={image}
              alt={project.alt}
              className={`ml-28 w-full h-[440px] border-[5px] rounded-2xl aspect-auto
            dark:border-gray-200`}
            />
          </div>
        ))}

        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
          <div
            className="h-10 flex gap-2 px-3 py-4 rounded-3xl backdrop-blur-md animate-carrousel-sections-in
            dark:backdrop-blur-sm"
          >
            {images.map((_, index) => (
              <button
                onClick={() => goTo(index)}
                className={`h-2 rounded-3xl transition-all duration-500
                ${index === current ? "w-8 bg-white dark:bg-[#28282b]" : "w-2 bg-[#ffffff5c] dark:bg-[#28282b8c]"}
                hover:cursor-pointer
              `}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 max-w-3xl">
        <h2 className="text-4xl font-semibold">{project.title}</h2>

        <p className="text-lg text-[#75777E] dark:text-[#7e8088]">
          {project.description}
        </p>
      </div>

      <div className="flex flex-col">
        <h3 className="font-semibold text-2xl">Stack</h3>
      </div>
    </div>
  );
}
