import { useTheme } from "./hooks/useTheme";
import Header from "./components/Header";
import SectionsContainer from "./components/SectionsContainer";

function App() {
  useTheme();

  return (
    <div className="w-full h-full">
      <Header />
      <SectionsContainer />
      <div id="modal-root"></div>
    </div>
  );
}

export default App;
