import { redirect } from "next/navigation";

export default function Home() {
  // Root route is protected by middleware; once authenticated, send users to a default conversation.
  redirect("/c/new");
}
