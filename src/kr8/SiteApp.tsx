import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

export default function SiteApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
