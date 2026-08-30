// Hooks
import { useState } from "react";
// Componentes
import Icon from "@components/ui/Icon";

export default function Accordion({ items = [], defaultOpen = null }) {
  const [openItem, setOpenItem] = useState(defaultOpen);

  return (
    <div
      className="w-full overflow-hidden rounded-3xl border border-[#E4E2E5]
      dark:border-[#202022]"
    >
      {items.map((item, index) => (
        <div
          key={item.title}
          className="border-b border-[#E4E2E5] last:border-b-0
          dark:border-[#202022]"
        >
          <button
            type="button"
            onClick={() => setOpenItem(openItem === index ? null : index)}
            aria-expanded={openItem === index}
            aria-controls={`accordion-panel-${index}`}
            className="w-full flex items-center justify-between gap-4 p-5 text-left transition-colors duration-200
            active:animate-click-effect
            hover:bg-[#F5F3F6] hover:cursor-pointer
            dark:hover:bg-[#101012]"
          >
            <span
              className="font-medium
              dark:text-[#E4E2E5]"
            >
              {item.title}
            </span>

            <Icon
              name="expand_more"
              size={22}
              className={`shrink-0 text-[#75777E] transition-transform duration-300
              ${openItem === index ? "rotate-180" : ""}
              dark:text-[#7E8088]`}
            />
          </button>

          <div
            id={`accordion-panel-${index}`}
            className={`grid transition-[grid-template-rows] duration-300 ease-out
            ${openItem === index ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="min-h-0 overflow-hidden">
              <p
                className="px-5 pb-5 text-[#75777E]
                dark:text-[#7E8088]"
              >
                {item.content}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
