import { useTranslation } from "../../i18n/language";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { useAuth } from "./AuthContext";
import { errorMessage, fieldErrors, validEmail } from "./forms";

export function RegisterPage({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const { t, translate } = useTranslation();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const issues: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length > 120)
      issues.fullName = "Enter your full name (1–120 characters).";
    if (!validEmail(email)) issues.email = "Enter a valid email address.";
    if (password.length < 12 || password.length > 128)
      issues.password = "Use 12–128 characters for your password.";
    if (confirmation !== password)
      issues.confirmation = "Passwords must match.";
    setErrors(issues);
    setError("");
    if (Object.keys(issues).length) return;
    setBusy(true);
    try {
      await register(fullName, email, password);
      setPassword("");
      setConfirmation("");
      setCreated(true);
    } catch (cause) {
      setErrors(fieldErrors(cause));
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  if (created)
    return (
      <section className="panel auth-panel">
        <h1>{t("Account created")}</h1>
        <Feedback kind="success">
          {t("Your member account is ready. Sign in to start borrowing.")}
        </Feedback>
        <Button onClick={() => onNavigate("/login")}>
          {t("Continue to sign in")}
        </Button>
      </section>
    );
  return (
    <section className="panel auth-panel" aria-labelledby="register-title">
      <p className="eyebrow">{t("Join the library")}</p>
      <h1 id="register-title">{t("Create account")}</h1>
      <p className="muted">
        {t(
          "New accounts receive the Member role. Staff access is assigned by an administrator.",
        )}
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
          label={t("Full name")}
          autoComplete="name"
          required
          maxLength={120}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
        />
        <FormField
          label={t("Email")}
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <FormField
          label={t("Password")}
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          hint={t("Use at least 12 characters.")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <FormField
          label={t("Confirm password")}
          type="password"
          autoComplete="new-password"
          required
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={errors.confirmation}
        />
        <Button type="submit" busy={busy}>
          {busy ? t("Creating account…") : t("Create account")}
        </Button>
      </form>
      <p>
        {t("Already registered?")}{" "}
        <button
          type="button"
          className="text-button"
          onClick={() => onNavigate("/login")}
        >
          {t("Sign in")}
        </button>
      </p>
    </section>
  );
}
