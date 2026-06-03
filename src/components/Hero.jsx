import { socials } from "../data/socials";
import SocialPill from "./SocialPill";

export default function Hero() {
  return (
    <section className="mx-auto mt-20 mb-32 lg:max-w-6xl dark:text-white">
      <div className="mb-5">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png"
          alt="Juan Alvarez"
          className="w-20 h-20 rounded-full"
        />
      </div>

      <div>
        <h1 className="text-5xl font-semibold font-dmsans">
          Hola, soy Juan Alvarez
        </h1>
      </div>

      <div className="text-xl font-semibold mt-5 dark:text-[#75777E]">Desarrollador full stack</div>

      <div className="flex gap-2 mt-10">
        {socials.map((social) => (
          <SocialPill
            key={social.title}
            href={social.href}
            title={social.title}
            icon={social.icon}
            iconDarkStyles={social.iconDarkStyles}
          />
        ))}
      </div>
    </section>
  );
}
