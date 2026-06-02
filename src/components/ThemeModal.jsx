export default function ThemeModal({ theme, setTheme, onClose }) {
  return (
    <div className="w-full flex flex-col gap-1 text-sm dark:text-white">
      <button
        onClick={() => {
          setTheme("light");
          onClose();
        }}
        className={`py-3.5 px-4 rounded-full text-start
        ${theme === "light" ? "bg-[#efedf0] dark:bg-[#28282b] font-semibold" : "bg-transparent"}
        hover:bg-[#efedf0] hover:cursor-pointer
        dark:text-white dark:hover:bg-[#28282b]`}
      >
        Claro
      </button>

      <button
        onClick={() => {
          setTheme("dark");
          onClose();
        }}
        className={`py-3.5 px-4 rounded-full text-start
        ${theme === "dark" ? "bg-[#28282b] font-semibold" : "bg-transparent"}
        hover:bg-[#efedf0] hover:cursor-pointer
        dark:text-white dark:hover:bg-[#28282b]`}
      >
        Oscuro
      </button>

      <button
        onClick={() => {
          setTheme("system");
          onClose();
        }}
        className={`py-3.5 px-4 rounded-full text-start
        ${theme === "system" ? "bg-[#efedf0] dark:bg-[#28282b] font-semibold" : "bg-transparent"}
        hover:bg-[#efedf0] hover:cursor-pointer
        dark:text-white dark:hover:bg-[#28282b]`}
      >
        Sistema
      </button>
    </div>
  );
}
