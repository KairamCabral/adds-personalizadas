import { AGREEMENT_CONTENT } from "@/lib/agreement-template";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AgreementContent() {
  const paragraphs = AGREEMENT_CONTENT.split(/\n\n+/).filter(Boolean);

  return (
    <ScrollArea className="h-[280px] rounded-lg border border-border bg-muted/30 p-4">
      <div className="space-y-4 text-sm">
        {paragraphs.map((para, i) => {
          const isTitle = para.startsWith("TERMO") || para.startsWith("CLÁUSULA");
          const isSubItem = /^[a-e]\)/.test(para.trim());

          return (
            <div key={i}>
              {isTitle ? (
                <p className="font-semibold text-foreground">{para}</p>
              ) : isSubItem ? (
                <p className="ml-4 text-muted-foreground">{para}</p>
              ) : (
                <p className="text-muted-foreground">{para}</p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
