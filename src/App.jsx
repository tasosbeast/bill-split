import "./index.css";
import AppShell from "./features/app/AppShell";
import ToastRegion from "./components/ToastRegion";

export default function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ToastRegion />
      <AppShell />
    </>
  );
}
