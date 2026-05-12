import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EstoqueOverview } from "./_components/estoque-overview";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role !== "MASTER" && role !== "GESTOR") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6 p-6">
      <EstoqueOverview role={role} />
    </div>
  );
}
