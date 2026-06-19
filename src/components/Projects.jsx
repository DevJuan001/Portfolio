import ProjectItem from "./ProjectItem";
import { projects } from "../data/projects";
import { technologies } from "../data/technologies";

export default function Projects() {
  const extendedProjects = projects.map((project) => ({
    ...project,
    stack: project.stack.map((technology) => technologies[technology]),
  }));

  return (
    <section id="projects" className="mx-auto mt-20 mb-32 lg:max-w-6xl">
      <h2 className="text-3xl font-bold dark:text-white">Proyectos</h2>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {extendedProjects.map((project) => (
          <ProjectItem key={project.title} project={project} />
        ))}
      </div>
    </section>
  );
}
