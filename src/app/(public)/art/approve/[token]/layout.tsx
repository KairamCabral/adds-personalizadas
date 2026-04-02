import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aprovação de Arte | ADDS Brasil",
  description: "Visualize e aprove a arte criada pela equipe ADDS.",
  openGraph: {
    title: "Aprovação de Arte | ADDS Brasil",
    description: "Visualize e aprove a arte criada pela equipe ADDS.",
    siteName: "ADDS Brasil",
  },
};

export default function ArtApproveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-start overflow-x-hidden bg-gray-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6 dark:bg-gray-950">
      <div className="w-full max-w-lg sm:max-w-xl lg:max-w-4xl xl:max-w-5xl">
        {children}
      </div>
    </div>
  );
}
