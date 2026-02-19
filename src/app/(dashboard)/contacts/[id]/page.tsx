import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactDetailView } from "../_components/contact-detail-view";

export const metadata: Metadata = {
  title: "Detalhes do contato",
};

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (clientError || !client) {
    notFound();
  }

  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, order_number, title, status, due_date, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const orders = ordersData ?? [];

  return <ContactDetailView client={client} orders={orders} />;
}
