import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./queryClient";
import { ThemeSync } from "./ThemeSync";
import { DataBootstrap } from "./DataBootstrap";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <DataBootstrap />
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-left" initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
