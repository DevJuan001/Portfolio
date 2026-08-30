// Data
import { projects } from "@data/projects";
// Componentes
import ProjectItem from "@components/ui/ProjectItem";

export default function Projects() {
  return (
    <section id="projects" className="mx-auto mt-20 mb-32 lg:max-w-6xl">
      <h2
        className="text-4xl font-dmsans font-semibold text-transparent bg-linear-to-r from-black to-[#75777e] bg-clip-text
        dark:from-[#E2E4E5] dark:to-[#878991]"
      >
        Proyectos
      </h2>

      <div className="mt-10 flex flex-col gap-10">
        {projects.map((project, index) => (
          <ProjectItem
            key={project.title}
            project={project}
            reversed={index % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}
