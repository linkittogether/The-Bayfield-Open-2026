import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Register Player · Bayfield Open" };

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const user = await getCurrentUser();
  if (user?.kind !== "admin") redirect("/login");

  return (
    <AppShell title="Register Player" showBack backTo={`/${yr}/admin`} year={yr}>
      <RegisterForm />
    </AppShell>
  );
}
