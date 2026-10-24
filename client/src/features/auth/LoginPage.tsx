import { useTranslation } from "../../i18n/language";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { useAuth } from "./AuthContext";
import { errorMessage, fieldErrors, validEmail } from "./forms";

export function LoginPage({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const { t, translate } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const issues: Record<string, string> = {};
    if (!validEmail(email)) issues.email = "Enter a valid email address.";
    if (!password || password.length > 128)
      issues.password = "Enter your password (up to 128 characters).";
    setErrors(issues);
    setError("");
    if (Object.keys(issues).length) return;
    setBusy(true);
    try {
      await login(email, password);
      onNavigate("/books");
    } catch (cause) {
      setErrors(fieldErrors(cause));
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-panel" aria-labelledby="login-title">
      <p className="eyebrow">{t("Welcome back")}</p>
      <h1 id="login-title">{t("Sign in")}</h1>
      <p className="muted">
        {t("Access your loans or manage the library with your assigned role.")}
      </p>
      {error && <Feedback kind="error">{translate(error)}</Feedback>}
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
        className="form-stack"
      >
        <FormField
          label={t("Email")}
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <FormField
          label={t("Password")}
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Button type="submit" busy={busy}>
          {busy ? t("Signing in…") : t("Sign in")}
        </Button>
      </form>
      <p>
        {t("New to BookFlow?")}{" "}
        <button
          type="button"
          className="text-button"
          onClick={() => onNavigate("/register")}
        >
          {t("Create an account")}
        </button>
      </p>
    </section>
  );
}
