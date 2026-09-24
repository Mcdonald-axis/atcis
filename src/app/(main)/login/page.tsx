import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/auth/v2/login");
  return null;
}
