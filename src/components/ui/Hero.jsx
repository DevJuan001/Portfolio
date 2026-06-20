// Data
import { socials } from "../../data/socials";
// Componentes
import SocialPill from "./SocialPill";

export default function Hero() {
  return (
    <section
      className="mx-auto mt-5 mb-32 lg:max-w-6xl dark:text-white
      md:mt-20"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png"
        alt="Juan Alvarez"
        className="w-20 h-20 mb-5 rounded-full"
      />

      <h1
        className="text-4xl font-semibold font-dmsans
          md:text-5xl"
      >
        Hola, soy Juan Alvarez
      </h1>

      <p
        className="w-80 mt-4 text-[#75777E] text-xl font-medium
          md:w-3xl"
      >
        Desarrollador Full Stack y Tecnólogo en Análisis y Desarrollo de
        Software de Bogotá, Colombia. Me especializo en construir aplicaciones
        web modernas, arquitecturas backend robustas. Apasionado por escribir
        código limpio y crear experiencias de usuario que marquen la diferencia.
      </p>

      <div className="flex gap-2 mt-8">
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
