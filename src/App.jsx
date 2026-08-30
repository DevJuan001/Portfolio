import { useTheme } from "@hooks/useTheme";
import Header from "@/components/ui/Navbar";
import SectionsContainer from "@components/ui/SectionsContainer";

function App() {
  useTheme();

  return (
    <div className="w-full flex flex-col">
      <Header />

      <SectionsContainer />

      <div id="modal-root"></div>
    </div>
  );
}

export default App;
