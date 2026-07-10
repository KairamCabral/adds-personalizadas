"use client";

import { motion } from "motion/react";

/**
 * Fundo de marca do telão: base navy escura + dois "blobs" (blue/orange)
 * derivando lentamente + vinheta. Fica atrás de todo o conteúdo.
 */
export function TelaoBackdrop({ intense = false }: { intense?: boolean }) {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[#06121f]">
      <motion.div
        aria-hidden
        className="absolute -left-[10%] -top-[15%] h-[70vh] w-[70vh] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, #21add6, transparent 65%)" }}
        animate={{
          x: [0, 60, -20, 0],
          y: [0, 40, 10, 0],
          opacity: intense ? [0.5, 0.75, 0.5] : [0.3, 0.45, 0.3],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-[15%] -right-[10%] h-[75vh] w-[75vh] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, #f07d00, transparent 65%)" }}
        animate={{
          x: [0, -50, 20, 0],
          y: [0, -30, -10, 0],
          opacity: intense ? [0.45, 0.7, 0.45] : [0.25, 0.4, 0.25],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* vinheta */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.6))]" />
    </div>
  );
}
