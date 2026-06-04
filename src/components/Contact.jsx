export default function Contact() {
  return (
    <section id="contact" className="mx-auto mt-20 mb-32 lg:max-w-6xl">
      <h2 className="text-3xl font-bold dark:text-white">Contacto</h2>

      <div className="flex justify-between">
        <form className="flex flex-col gap-2">
          <span>Nombre Completo</span>
          <span>Correo electrónico</span>
          <span>Mensaje</span>
        </form>

      </div>
    </section>
  );
}
