import { projects } from "../data/projects";
import { technologies } from "../data/technologies";
import ProjectItem from "./ProjectItem";

export default function Projects() {
  const extendedProjects = projects.map((project) => ({
    ...project,
    stack: project.stack.map((technology) => technologies[technology]),
  }));

  return (
    <section id="projects" className="mx-auto mt-20 mb-32 lg:max-w-6xl">
      <h2 className="text-3xl font-bold dark:text-white">Proyectos</h2>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2">
        {extendedProjects.map((project) => (
          <ProjectItem
            key={project.title}
            image={project.image}
            alt={project.alt}
            title={project.title}
            description={project.description}
            link={project.link}
            github={project.github}
            stack={project.stack}
          />
        ))}
      </div>
    </section>
  );
}
