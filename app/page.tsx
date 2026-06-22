import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authCapability } from "@/infrastructure/auth";

export default async function Home() {
  const session = await authCapability.getSession(await headers());
  redirect(session ? "/report" : "/sign-in");
}
