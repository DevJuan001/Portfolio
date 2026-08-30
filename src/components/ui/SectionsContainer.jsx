import Hero from "@components/ui/Hero";
import Footer from "@components/ui/Footer";
import Contact from "@components/ui/Contact";
import Projects from "@components/ui/Projects";

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
