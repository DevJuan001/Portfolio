import Icon from "@components/ui/Icon";
import { contact } from "@data/contact";
import { useCopyToClipboard } from "@hooks/useCopyToClipboard";

export default function Contact() {
  const { copied, copy } = useCopyToClipboard();

  return (
    <section
      id="contact"
      className="flex flex-col mx-auto mt-20 mb-32 gap-8 font-dmsans
      lg:max-w-6xl"
    >
      <div className="flex flex-col gap-2">
        <h2
          className="text-4xl font-semibold text-transparent bg-linear-to-r from-black to-[#75777e] bg-clip-text
          dark:from-[#E2E4E5] dark:to-[#878991]"
        >
          Contacto
        </h2>

        <p
          className="max-w-2xl text-[#75777E]
          dark:text-[#7E8088]"
        >
          Cuentame qué estás construyendo y en qué punto está, aunque sea
          todavía una idea suelta. Te respondo con una propuesta concreta: qué
          haría falta y cuánto tiempo lleva.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="text-2xl font-medium select-none
          md:text-3xl
          dark:text-[#E4E2E5]"
        >
          {contact.emailMasked}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 py-3 px-5 rounded-full bg-black text-sm font-medium text-white transition-colors duration-200
            hover:bg-[#28282B]
            active:animate-click-effect
            dark:bg-[#E4E2E5] dark:text-black dark:hover:bg-white"
          >
            <Icon name="mail" size={18} />
            <span>Correo</span>
          </a>

          <button
            type="button"
            onClick={() => copy(contact.email)}
            aria-label="Copiar correo electrónico"
            className="flex items-center gap-2 py-3 px-5 rounded-full border border-[#E4E2E5] text-sm font-medium transition-colors duration-200
            hover:bg-[#F5F3F6]
            dark:border-[#202022] dark:text-[#E4E2E5] dark:hover:bg-[#101012]"
          >
            <Icon
              size={18}
              name={copied ? "check" : "content_copy"}
              className={copied ? "text-green-700" : "text-black"}
            />

            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <dl className="flex flex-wrap gap-8 pt-2 text-sm">
        {contact.details.map((detail) => (
          <div
            key={detail.label}
            className="flex items-start grow basis-56 gap-3"
          >
            <Icon
              name={detail.icon}
              size={22}
              className="mt-0.5 text-[#75777E] dark:text-[#7E8088]"
            />

            <div className="flex flex-col">
              <dt
                className="text-[#75777E]
                dark:text-[#7E8088]"
              >
                {detail.label}
              </dt>

              <dd
                className="font-medium
                dark:text-[#E4E2E5]"
              >
                {detail.value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
