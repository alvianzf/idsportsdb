import { Toaster } from "react-hot-toast";
import { AppRouter } from "./routes/AppRouter";

function App() {
  return (
    <>
      <AppRouter />
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </>
  );
}

export default App;
