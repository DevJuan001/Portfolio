import { useTheme } from "./hooks/useTheme";
import Header from "./components/ui/Header";
import SectionsContainer from "./components/ui/SectionsContainer";

function App() {
  useTheme();

  return (
    <div className="w-full">
      <Header />

      <SectionsContainer />

      <div id="modal-root"></div>
    </div>
  );
}

export default App;
