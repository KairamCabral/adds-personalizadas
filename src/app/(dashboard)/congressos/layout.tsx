import { CongressosNav } from "./_components/congressos-nav";

/**
 * Layout do módulo Congressos: barra de abas (Edições · Retirada · Saúde da fila)
 * no topo de todas as telas, acima do conteúdo de cada página.
 */
export default function CongressosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="px-6 pt-4">
        <CongressosNav />
      </div>
      {children}
    </div>
  );
}
