export default function SocialPill({ href, icon, iconDarkStyles, title }) {
  return (
    <a
      target="_blank"
      href={href}
      className="flex items-center gap-2 py-2 px-4 rounded-3xl text-sm font-medium border border-[#c5c6ce]
      hover:bg-gray-200 hover:text-[#1b1b1e] hover:scale-[1.05]
      dark:text-[#d1d5db] dark:hover:text-white dark:hover:bg-[#28282b] dark:border-[#3a3d43]"
    >
      <img src={icon} className={`w-4 h-4 ${iconDarkStyles}`} />
      
      <span>{title}</span>
    </a>
  );
}
