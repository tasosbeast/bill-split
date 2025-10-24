import "./index.css";
import LegacyAppShell from "./features/legacyApp/LegacyAppShell";
import ToastRegion from "./components/ToastRegion";

export default function App() {
  return (
    <>
      <ToastRegion />
      <LegacyAppShell />
    </>
  );
}
