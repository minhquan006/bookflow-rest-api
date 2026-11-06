import { AppRouter } from "./app/AppRouter";
import { AuthProvider } from "./features/auth/AuthContext";
import { LanguageProvider } from "./i18n/LanguageProvider";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
}
