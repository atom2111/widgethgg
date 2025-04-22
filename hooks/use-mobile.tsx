"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Проверяем, что код выполняется в браузере
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(mql.matches);
    };

    // Устанавливаем начальное значение
    setIsMobile(mql.matches);

    // Добавляем слушатель для изменений медиа-запроса
    mql.addEventListener("change", onChange);

    // Очистка слушателя при размонтировании
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}