import "./index.css";
import LegacyAppShell from "./features/legacyApp/LegacyAppShell";
import ToastRegion from "./components/ToastRegion";

export default function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ToastRegion />
      <LegacyAppShell />
    </>
  );
}
