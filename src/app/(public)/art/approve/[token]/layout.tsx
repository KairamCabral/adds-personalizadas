import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

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
      <div className="mb-4 flex shrink-0 justify-center sm:mb-6">
        <a
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-90"
        >
          <Logo size="lg" className="h-10 w-10 sm:h-12 sm:w-12" priority />
          <span className="text-lg font-bold text-[#0b4269] sm:text-xl dark:text-[#21add6]">
            ADDS
          </span>
          <span className="text-base font-semibold text-[#21add6] sm:text-lg">
            CRM
          </span>
        </a>
      </div>
      <div className="w-full max-w-lg sm:max-w-xl lg:max-w-4xl xl:max-w-5xl">
        {children}
      </div>
    </div>
  );
}
