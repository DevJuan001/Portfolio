import { icons } from "../assets/icons";
import Icon from "./Icon";

export default function ProjectItem({
  image,
  alt,
  title,
  description,
  github,
  link,
  stack,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl">
      <img
        src={image}
        alt={alt}
        className="w-full h-72 object-cover shadow-[1px_1px_6px_3px_#e5e7eb] rounded-3xl
         dark:border-gray-200"
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold dark:text-gray-100">{title}</h3>

        <div className="flex flex-wrap gap-2">
          {stack.map((technology) => (
            <div
              className={`flex items-center gap-1 py-1 px-3 rounded-full 
                ${technology.styles}
              `}
            >
              <technology.icon className="w-4 h-4" />
              <span className="text-xs">{technology.name}</span>
            </div>
          ))}
        </div>

        <p className="text-[#75777E] dark:text-[#7e8088]">{description}</p>

        <div className="flex gap-4 mt-2">
          {github && (
            <button
              className="flex items-center gap-2 py-2 px-4 border border-[#c5c6ce] rounded-xl transition-colors duration-200 group
                hover:bg-black hover:cursor-pointer hover:text-white
                dark:text-white dark:border-[#3a3d43] dark:hover:bg-white dark:hover:text-black"
            >
              <icons.githubLight
                className="w-5 h-5 transition-all duration-200 
                dark:invert dark:group-hover:invert-0
                group-hover:invert"
              />

              <span>Github</span>
            </button>
          )}

          {link && (
            <button
              className="flex items-center gap-2 py-2 px-4 border border-[#c5c6ce] rounded-xl transition-colors duration-200 group
              hover:bg-black hover:cursor-pointer hover:text-white
              dark:text-white dark:border-[#3a3d43] dark:hover:bg-white dark:hover:text-black"
            >
              <Icon name={"open_in_new"} size={16} />

              <span>Ver</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
