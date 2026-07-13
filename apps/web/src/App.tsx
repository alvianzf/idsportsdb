import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { AppRouter } from "./routes/AppRouter";
import { bootstrapAuth } from "./lib/api";

function App() {
  // Restore the session from the httpOnly refresh cookie on startup.
  useEffect(() => {
    void bootstrapAuth();
  }, []);

  return (
    <>
      <AppRouter />
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </>
  );
}

export default App;
