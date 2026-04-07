import { redirect } from "next/navigation";

export default function SandboxPage() {
  redirect("/hub?mode=sandbox");
}
