// Hooks
import { useTabs } from "@hooks/useTabs";

export default function Tabs({ tabs = [], activeTab = 0, onChange }) {
  const { listRef, indicatorRef, registerTab } = useTabs({ activeTab });

  return (
    <div
      ref={listRef}
      role="tablist"
      className="relative w-full flex flex-wrap gap-1 self-start p-1.5 rounded-full bg-[#F5F3F6]
      dark:bg-[#101012]"
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="absolute top-0 left-0 rounded-full bg-white
        dark:bg-[#28282B]"
      />

      {tabs.map((tab, index) => (
        <button
          key={tab}
          ref={registerTab(index)}
          type="button"
          role="tab"
          id={`tab-${index}`}
          aria-selected={activeTab === index}
          aria-controls={`tab-panel-${index}`}
          onClick={() => onChange(index)}
          className={`relative grow basis-40 p-3 rounded-full text-sm font-medium font-dmsans transition-colors duration-300
          hover:cursor-pointer
          xl:text-base xl:p-6
          ${
            activeTab === index
              ? "dark:text-[#E4E2E5]"
              : `text-[#75777E]
                hover:text-black
                dark:text-[#7E8088] dark:hover:text-[#E4E2E5]`
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
