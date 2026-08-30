// Hooks
import { useState } from "react";
// Iconos
import { icons } from "@assets/icons";
// Componentes
import Icon from "@components/ui/Icon";
import Tabs from "@components/ui/Tabs";
import Accordion from "@components/ui/Accordion";
// Modales
import Modal from "@modals/Modal";

export default function ProjectModal({ isOpen, triggerRef, onClose, project }) {
  const [activeModule, setActiveModule] = useState(0);

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
          {project.images.map((image, index) => (
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
            className="flex flex-col justify-between gap-3
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

            <div
              className="flex flex-col gap-2
              sm:flex-row sm:items-center"
            >
              {project.github && (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={project.github}
                  className="flex items-center justify-center gap-2 py-2 px-4 border border-[#c5c6ce] rounded-3xl transition-colors duration-200 group
                  active:animate-click-effect
                  hover:bg-black hover:text-white hover:cursor-pointer
                  dark:text-white dark:border-[#3a3d43] dark:hover:bg-white dark:hover:text-black"
                >
                  <icons.githubLight
                    className="w-5 h-5 transition-all duration-200
                    dark:invert dark:group-hover:invert-0
                    group-hover:invert"
                  />

                  <span>Github</span>
                </a>
              )}

              {project.link && (
                <a
                  target="_blank"
                  rel="noreferrer"
                  data-shared-id="open-project-button"
                  href={project.link}
                  className="flex items-center justify-center gap-2 py-2 px-4 bg-black text-white border border-[#c5c6ce] rounded-3xl transition-colors duration-200
                  active:animate-click-effect
                  hover:bg-black/85 hover:cursor-pointer
                  dark:bg-white dark:text-black dark:border-[#3a3d43] dark:hover:bg-neutral-200"
                >
                  <Icon name={"open_in_new"} size={16} />

                  <span>Abrir</span>
                </a>
              )}
            </div>
          </div>

          {project.challenge && (
            <div className="flex flex-col gap-2">
              <h3 className="text-3xl font-semibold">El problema</h3>

              <p
                className="text-[#75777E]
                dark:text-[#7E8088]"
              >
                {project.challenge}
              </p>
            </div>
          )}

          {project.objective && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-3xl font-semibold">Objetivo</h3>

                <p
                  className="text-[#75777E]
                  dark:text-[#7E8088]"
                >
                  {project.objective}
                </p>
              </div>

              {project.objectiveModules && (
                <div className="w-full flex flex-col gap-5">
                  <Tabs
                    tabs={project.objectiveModules.map((module) => module.title)}
                    activeTab={activeModule}
                    onChange={setActiveModule}
                  />

                  <ul
                    role="tabpanel"
                    id={`tab-panel-${activeModule}`}
                    aria-labelledby={`tab-${activeModule}`}
                    className="flex flex-col gap-1.5"
                  >
                    {project.objectiveModules[activeModule].items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-1.5 text-[#75777E]
                        dark:text-[#7E8088]"
                      >
                        <Icon
                          name={"check_small"}
                          size={18}
                          className="shrink-0 mt-0.5"
                        />

                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {project.features && (
            <div className="flex flex-col gap-4">
              <h3 className="text-3xl font-semibold">Características</h3>

              <div className="w-full flex flex-wrap gap-2">
                {project.features.map((feature) => (
                  <div
                    key={feature.title}
                    className="min-w-0 grow basis-92 flex gap-2 p-6 bg-[#F5F3F6] rounded-4xl
                    md:h-72
                    dark:bg-[#101012]"
                  >
                    <div
                      className="h-fit flex items-center justify-center p-2 bg-[#E4E2E5] rounded-full
                      dark:bg-[#28282B] dark:text-[#E4E2E5]"
                    >
                      <Icon name={feature.icon} fill />
                    </div>

                    <div className="w-full flex flex-col mt-1 gap-1">
                      <span
                        className="text-2xl font-medium
                        dark:text-[#E4E2E5]"
                      >
                        {feature.title}
                      </span>

                      <span
                        className="text-[#75777E]
                        dark:text-[#7E8088]"
                      >
                        {feature.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.technicalDecisions && (
            <div className="flex flex-col gap-4">
              <h3 className="text-3xl font-semibold">Decisiones técnicas</h3>

              <Accordion items={project.technicalDecisions} defaultOpen={0} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
