import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Register Player · Bayfield Open" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user?.kind !== "admin") redirect("/login");

  return (
    <AppShell title="Register Player" showBack backTo="/admin">
      <RegisterForm />
    </AppShell>
  );
}
