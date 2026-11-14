import { RouterProvider } from "react-router-dom";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Providers } from "./providers";
import { router } from "./router";

export default function App() {
  return (
    <Providers>
      <AmbientBackground />
      <RouterProvider router={router} />
    </Providers>
  );
}
