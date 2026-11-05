import { useTranslation } from "../i18n/language";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { UsersPage } from "../features/users/UsersPage";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { BookDetailPage } from "../features/catalog/BookDetailPage";
import { CategoriesPage } from "../features/catalog/CategoriesPage";
import { LoansPage } from "../features/loans/LoansPage";
import { DashboardPage } from "../features/administration/DashboardPage";
import { AuditPage } from "../features/administration/AuditPage";
import { HomePage } from "../features/home/HomePage";
import { Button } from "../components/Button";
import { Feedback } from "../components/Feedback";
import { AppLayout } from "./AppLayout";
import { usePath } from "./usePath";

export function AppRouter() {
  const { t, translate } = useTranslation();
  const { path, navigate } = usePath();
  const { user, loading, api } = useAuth();
  const viewer = user ? `${user.id}:${user.role}` : "anonymous";
  const staff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";
  let content;
  const protectedPath = [
    "/account",
    "/users",
    "/loans",
    "/categories",
    "/dashboard",
    "/audit-logs",
  ].includes(path);
  if (protectedPath && loading)
    content = (
      <Feedback kind="loading">{t("Restoring your session…")}</Feedback>
    );
  else if (protectedPath && !user)
    content = (
      <section className="panel">
        <h1>{t("Sign in to continue")}</h1>
        <p>
          {t("Your library account keeps your loans and information together.")}
        </p>
        <Button onClick={() => navigate("/login")}>{t("Sign in")}</Button>
      </section>
    );
  else if (path === "/") content = <HomePage onNavigate={navigate} />;
  else if (path === "/login") content = <LoginPage onNavigate={navigate} />;
  else if (path === "/register")
    content = <RegisterPage onNavigate={navigate} />;
  else if (path === "/loans") content = <LoansPage onNavigate={navigate} />;
  else if (path === "/dashboard")
    content = staff ? (
      <DashboardPage />
    ) : (
      <Feedback kind="error">
        {t("Staff access is required to view the dashboard.")}
      </Feedback>
    );
  else if (path === "/audit-logs")
    content =
      user?.role === "ADMIN" ? (
        <AuditPage />
      ) : (
        <Feedback kind="error">
          {t("Administrator access is required to view the audit log.")}
        </Feedback>
      );
  else if (path === "/books")
    content = (
      <CatalogPage
        key={viewer}
        client={api}
        user={user}
        onNavigate={navigate}
      />
    );
  else if (/^\/books\/[^/]+$/.test(path))
    content = (
      <BookDetailPage
        key={`${viewer}:${path}`}
        bookId={path.split("/")[2]!}
        onNavigate={navigate}
      />
    );
  else if (path === "/categories")
    content = staff ? (
      <CategoriesPage />
    ) : (
      <Feedback kind="error">
        {t("Catalog management is available to librarians and administrators.")}
      </Feedback>
    );
  else if (path === "/users")
    content =
      user?.role === "ADMIN" ? (
        <UsersPage />
      ) : (
        <Feedback kind="error">
          {t("You do not have permission to view this page.")}
        </Feedback>
      );
  else if (path === "/account")
    content = (
      <section className="panel">
        <p className="eyebrow">{t("YOUR ACCOUNT")}</p>
        <h1>{user?.fullName}</h1>
        <dl>
          <dt>{t("Email")}</dt>
          <dd>{user?.email}</dd>
          <dt>{t("Role")}</dt>
          <dd>{user && translate(user.role)}</dd>
        </dl>
        <Button onClick={() => navigate("/loans")}>
          {t("View your loans")}
        </Button>
      </section>
    );
  else
    content = (
      <section className="panel">
        <h1>{t("Page not found")}</h1>
        <p>{t("Choose a page from the navigation to continue.")}</p>
        <Button onClick={() => navigate("/")}>{t("Back to overview")}</Button>
      </section>
    );
  return (
    <AppLayout path={path} onNavigate={navigate}>
      {content}
    </AppLayout>
  );
}
