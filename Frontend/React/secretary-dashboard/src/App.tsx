import { BrowserRouter } from "react-router";
import AppRouter from "./router/AppRouter";

function App() {
  const rawBase = import.meta.env.BASE_URL ?? "/";
  const basename =
    rawBase === "/" ? undefined : rawBase.replace(/\/$/, "") || undefined;

  return (
    <BrowserRouter basename={basename}>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
