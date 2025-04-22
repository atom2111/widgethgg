'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Клиентский компонент для обработки useSearchParams
const SuccessContent = () => {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get('transactionId');

  useEffect(() => {
    const sendPartnerCallback = async () => {
      if (transactionId) {
        try {
          await fetch('http://82.115.60.5:5145/payment/partner-callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ transactionId }),
          });
        } catch {
          // Игнорируем все ошибки
        }
      }
    };

    sendPartnerCallback();
  }, [transactionId]);

  return <></>;
};

// Основной компонент страницы
export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <SuccessContent />
    </Suspense>
  );
}