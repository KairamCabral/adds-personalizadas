import { QuoteLightMode } from "./_components/quote-light-mode";

export default function QuoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <QuoteLightMode />
      <div className="w-full min-w-0">{children}</div>
    </>
  );
}
