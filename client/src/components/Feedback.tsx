import type { ReactNode } from "react";

export function Feedback({
  kind,
  children,
}: {
  kind: "loading" | "error" | "empty" | "success";
  children: ReactNode;
}) {
  return (
    <div
      className={`feedback feedback--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
