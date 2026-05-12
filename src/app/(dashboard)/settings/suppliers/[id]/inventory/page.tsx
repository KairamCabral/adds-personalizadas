import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InventoryView } from "./_components/inventory-view";

export const dynamic = "force-dynamic";

export default async function SupplierInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, inventory_config")
    .eq("id", id)
    .single();

  if (!supplier) notFound();

  return (
    <div className="space-y-6 p-6">
      <InventoryView supplier={supplier} role={role} />
    </div>
  );
}
