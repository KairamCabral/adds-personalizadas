"use client";

import { useCallback, useEffect, useState } from "react";

interface FullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}
interface FullscreenDoc extends Document {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
}

/**
 * Wrapper da Fullscreen API nativa (telão do sorteio). `enter` deve ser chamado
 * num gesto do usuário. Tolera browsers com prefixo webkit e falha silenciosa
 * (fullscreen pode ser bloqueado — o telão continua funcional em janela).
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const doc = document as FullscreenDoc;
      setIsFullscreen(
        Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement)
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const enter = useCallback((el?: HTMLElement | null) => {
    const target = (el ?? document.documentElement) as FullscreenEl;
    const req = target.requestFullscreen ?? target.webkitRequestFullscreen;
    if (req) void req.call(target).catch(() => {});
  }, []);

  const exit = useCallback(() => {
    const doc = document as FullscreenDoc;
    const ex = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    if (ex && (doc.fullscreenElement ?? doc.webkitFullscreenElement)) {
      void ex.call(doc).catch(() => {});
    }
  }, []);

  return { isFullscreen, enter, exit };
}
