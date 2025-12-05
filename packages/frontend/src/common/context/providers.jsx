import { RootProvider, AuthProvider, ThemeProvider } from "@/common/context";

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <RootProvider>
        <AuthProvider>{children}</AuthProvider>
      </RootProvider>
    </ThemeProvider>
  );
}
