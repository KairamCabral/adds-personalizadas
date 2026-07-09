import { CongressoLightMode } from "./_components/congresso-light-mode";

export default function CongressoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CongressoLightMode />
      <div className="w-full min-w-0">{children}</div>
    </>
  );
}
