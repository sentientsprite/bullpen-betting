import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");
  return <>{children}</>;
}
