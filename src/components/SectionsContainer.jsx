import Contact from "./Contact";
import Footer from "./Footer";
import Hero from "./Hero";
import Projects from "./Projects";

export default function SectionsContainer() {
  return (
    <main className="px-8 pb-8">
      <Hero />
      <Projects />
      <Contact />
      <Footer />
    </main>
  );
}
