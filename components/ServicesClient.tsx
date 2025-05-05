"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

// Интерфейсы
interface AdditionalParameter {
  name: string;
  description: string;
  regex: string;
}

interface Service {
  id: number;
  name: string;
  iconUrl: string;
  categoryId: number;
  description: string;
  additionalParameters?: AdditionalParameter[];
  currencyISO?: string;
}

interface FormData {
  [key: string]: string;
}

interface FormErrors {
  [key: string]: string;
}

interface CheckoutFormProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | null;
}

interface TransactionContent {
  Service?: string;
  Account?: string;
  Amount?: number;
  Currency?: string | null;
  ExchangeRate?: number;
  ServiceCurrency?: string | null;
  Extras?: { FieldName: string; FieldValue: string }[];
}

interface ResponseModel {
  ResponseStatus?: string | number;
  Error?: string;
  TransactionContent?: {
    Extras?: { FieldName: string; FieldValue: string }[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface ApiResponse {
  ResponseLog?: ResponseModel | string;
  message?: string;
  details?: string;
}

const generateTransactionId = (): string => {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10).toString()).join("");
};

const CheckoutForm = ({ isOpen, onClose, service }: CheckoutFormProps) => {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [checkMessage, setCheckMessage] = useState<string>("");
  const [accountCheckStatus, setAccountCheckStatus] = useState<"success" | "error" | null>(null);
  const [isAmountAutoFilled, setIsAmountAutoFilled] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currencyISO, setCurrencyISO] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  // Загрузка sessionId при открытии формы
  useEffect(() => {
    if (isOpen && token) {
      const fetchSession = async () => {
        setIsSessionLoading(true);
        try {
          const sessionRes = await fetch(`https://widgetapipayment.hgg.kz/api/payment/get-session?token=${token}`);
          if (!sessionRes.ok) {
            const err = await sessionRes.json();
            throw new Error(`Не удалось получить sessionId: ${err.message || sessionRes.statusText}`);
          }
          const data = await sessionRes.json();
          console.log("Ответ от get-session:", data);
          if (!data.sessionId) {
            throw new Error("Некорректный ответ API: отсутствует sessionId");
          }
          setSessionId(data.sessionId);
        } catch (err) {
          console.error("Ошибка получения сессии:", err);
          setErrors({ submit: "Ошибка инициализации формы: не удалось получить сессию. Обратитесь в поддержку." });
        } finally {
          setIsSessionLoading(false);
        }
      };
      fetchSession();
    }
  }, [isOpen, token]);

  // Загрузка валюты сервиса
  useEffect(() => {
    if (isOpen && service?.id && token) {
      const fetchCurrency = async () => {
        try {
          const serviceRes = await fetch(`https://widgetapipayment.hgg.kz/api/payment/GetServiceById?serviceId=${service.id}`, {
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
              Authorization: `Bearer ${token}`,
            },
          });
          if (!serviceRes.ok) {
            const err = await serviceRes.json();
            console.error("Ошибка ответа API GetServiceById:", err);
            throw new Error(err.message || `Ошибка HTTP: ${serviceRes.statusText}`);
          }
          const serviceData = await serviceRes.json();
          console.log("Данные сервиса от GetServiceById:", serviceData);
          if (!serviceData.currencyISO) {
            throw new Error("Валюта не указана для сервиса");
          }
          setCurrencyISO(serviceData.currencyISO);
        } catch (err) {
          console.error("Ошибка получения валюты сервиса:", err);
          const errorMessage = err instanceof Error 
            ? `Ошибка загрузки валюты: ${err.message}. Проверьте настройки сервиса или обратитесь в поддержку.` 
            : "Ошибка загрузки валюты. Проверьте настройки сервиса или обратитесь в поддержку.";
          setErrors({ submit: errorMessage });
          setCurrencyISO(null);
        }
      };
      fetchCurrency();
    }
  }, [isOpen, service, token]);

  // Инициализация formData при изменении сервиса
  useEffect(() => {
    if (service) {
      const initialFormData: FormData = {};
      service.additionalParameters?.forEach((param) => {
        initialFormData[param.name] = "";
      });
      initialFormData.account = "";
      initialFormData.amount = "";
      setFormData(initialFormData);
      setIsSuccess(false);
      setCheckMessage("");
      setErrors({});
      setAccountCheckStatus(null);
      setIsAmountAutoFilled(false);
    }
  }, [service]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "account") {
      setCheckMessage("");
      setAccountCheckStatus(null);
      setErrors((prev) => ({ ...prev, account: "" }));
    }
  };

  const handleAccountBlur = async () => {
    if (!formData.account?.trim()) {
      setErrors({ account: "Поле аккаунта обязательно для заполнения" });
      setAccountCheckStatus(null);
      return;
    }

    if (!token || !sessionId || !currencyISO) {
      setErrors({ submit: "Токен, sessionId или валюта отсутствует" });
      setAccountCheckStatus(null);
      return;
    }

    setIsLoading(true);
    setCheckMessage("");
    setAccountCheckStatus(null);

    try {
      const checkData = {
        token,
        sessionId,
        transactionId: generateTransactionId(),
        service: String(service?.id || ""),
        amount: "0",
        currency: currencyISO,
        account: String(formData.account),
        additionalParams: Object.fromEntries(
          (service?.additionalParameters || []).map((param) => [param.name, formData[param.name] || ""])
        ),
      };

      console.log("Отправка checkData на account-check:", checkData);

      const checkRes = await fetch("https://widgetapipayment.hgg.kz/api/payment/account-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkData),
      });

      const responseData: ApiResponse = await checkRes.json();
      console.log("Ответ AccountCheck:", responseData);

      if (!checkRes.ok) {
        const errorMessage = responseData.message || `Ошибка AccountCheck: ${checkRes.status}`;
        setAccountCheckStatus("error");
        setCheckMessage(errorMessage);
        throw new Error(errorMessage);
      }

      const responseLog = typeof responseData.ResponseLog === "string" 
        ? JSON.parse(responseData.ResponseLog) 
        : responseData.ResponseLog || responseData;

      if (!responseLog || !responseLog.ResponseStatus) {
        console.error("Недостаточно данных в ответе API:", responseData);
        setAccountCheckStatus("error");
        setCheckMessage("Некорректный формат ответа сервера");
        throw new Error("Некорректный формат ответа сервера");
      }

      const responseStatus = responseLog.ResponseStatus;
      const isSuccess = responseStatus === 10 || responseStatus === "10";

      if (isSuccess) {
        setAccountCheckStatus("success");
        if (service?.categoryId === 7) {
          const extras = responseLog.TransactionContent?.Extras || [];
          const orderAmount = extras.find(
            (extra: { FieldName: string; FieldValue: string }) => extra.FieldName === "OrderAmount"
          )?.FieldValue;

          if (orderAmount && !isNaN(parseFloat(orderAmount))) {
            const formattedAmount = parseFloat(orderAmount).toFixed(2);
            setFormData((prev) => ({ ...prev, amount: formattedAmount }));
            setCheckMessage(`Цена ваучера: ${formattedAmount} ${currencyISO}`);
            setIsAmountAutoFilled(true);
          } else {
            setCheckMessage("Сумма не получена от сервиса");
            setAccountCheckStatus("error");
          }
        } else {
          setFormData((prev) => ({ ...prev, amount: "" }));
          setIsAmountAutoFilled(false);
        }
      } else {
        setAccountCheckStatus("error");
        setCheckMessage(
          responseLog.Error ||
            `Сервис недоступен или аккаунт некорректен (ResponseStatus: ${responseStatus})`
        );
      }
    } catch (err) {
      console.error("Ошибка проверки аккаунта:", err);
      setAccountCheckStatus("error");
      setCheckMessage(
        err instanceof Error
          ? err.message
          : "Ошибка при проверки аккаунта. Попробуйте позже или обратитесь в поддержку."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const validate = () => {
    const tempErrors: FormErrors = {};
    const fields = [
      ...(service?.additionalParameters || []),
      { name: "account", description: "Аккаунт", regex: ".*" },
      { name: "amount", description: "Сумма", regex: "^[0-9]+(\\.[0-9]{1,2})?$" },
    ];

    fields.forEach((param) => {
      if (!formData[param.name]?.trim()) {
        tempErrors[param.name] = `${param.description} обязателен для заполнения`;
      } else if (!new RegExp(param.regex).test(formData[param.name])) {
        tempErrors[param.name] = `Некорректный формат для ${param.description}`;
      }
    });

    return tempErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (accountCheckStatus !== "success") {
      setErrors({ submit: checkMessage || "Проверка аккаунта не пройдена" });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!token || !sessionId || !currencyISO) {
      setErrors({ submit: "Токен, sessionId или валюта отсутствует" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const paymentData = {
        token,
        sessionId,
        service: String(service?.id || ""),
        amount: String(formData.amount),
        currency: currencyISO,
        account: String(formData.account),
        additionalParams: Object.fromEntries(
          (service?.additionalParameters || []).map((param) => [
            param.name,
            String(formData[param.name] || ""),
          ])
        ),
      };

      console.log("Отправка paymentData на payment endpoint:", paymentData);

      const paymentEndpoint =
        service?.categoryId === 7
          ? "https://widgetapipayment.hgg.kz/api/payment/process-payment"
          : "https://widgetapipayment.hgg.kz/api/payment/create-payment";

      const paymentResponse = await fetch(paymentEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.message || "Ошибка создания платежа");
      }

      const paymentResult = await paymentResponse.json();

      setIsLoading(false);
      setIsSuccess(true);

      setTimeout(() => {
        router.push(`/success?transactionId=${paymentResult.transactionId}`);
      }, 2000);
    } catch (error) {
      setIsLoading(false);
      setErrors({
        submit: error instanceof Error ? error.message : "Ошибка создания платежа",
      });
    }
  };

  if (!service) return null;

  if (isSessionLoading) {
    return (
      <div className="fixed z-50 w-full md:w-96 bg-white shadow-lg p-6 flex items-center justify-center h-[600px] md:h-full top-0 right-0">
        <div className="spinner w-8 h-8 border-4 border-t-transparent border-gray-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currencyISO) {
    return (
      <div className="fixed z-50 w-full md:w-96 bg-white shadow-lg p-6 h-[600px] md:h-full top-0 right-0">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-xl"
        >
          ✕
        </button>
        <p className="text-red-500 text-center mt-10">
          {errors.submit || "Ошибка загрузки валюты. Проверьте настройки сервиса или обратитесь в поддержку."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 w-full md:w-96 bg-white shadow-lg p-0 md:p-6 transition-all duration-700 ease-in-out overflow-y-auto top-0 ${
        isOpen
          ? "right-0 h-[600px] opacity-100 md:h-full"
          : "right-[-100%] h-0 opacity-0 md:h-full"
      }`}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-xl"
      >
        ✕
      </button>
      <div className="text-center mb-6 pt-4 px-4">
        <h1 className="text-xl md:text-2xl font-semibold">{service.name}</h1>
      </div>
      <form onSubmit={handleSubmit} noValidate className="px-4 pb-4">
        {service.additionalParameters?.map((param, index) => (
          <div key={`${param.name}-${index}`} className="mb-4">
            <input
              name={param.name}
              placeholder={param.description}
              className={`border ${
                errors[param.name] ? "border-red-500" : "border-gray-300"
              } w-full pl-4 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
              value={formData[param.name] || ""}
              onChange={handleChange}
              aria-label={param.description}
              disabled={isLoading || isSuccess}
            />
            {errors[param.name] && (
              <p className="text-red-500 text-xs mt-1">{errors[param.name]}</p>
            )}
          </div>
        ))}
        <div className="mb-4 relative">
          <input
            name="account"
            placeholder="Аккаунт"
            className={`border ${
              errors.account
                ? "border-red-500"
                : accountCheckStatus === "success"
                ? "border-green-500"
                : accountCheckStatus === "error"
                ? "border-red-500"
                : "border-gray-300"
            } w-full pl-4 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            value={formData.account || ""}
            onChange={handleChange}
            onBlur={handleAccountBlur}
            aria-label="Аккаунт"
            disabled={isLoading || isSuccess}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="spinner w-4 h-4 border-2 border-t-transparent border-gray-600 rounded-full animate-spin"></div>
            </div>
          )}
          {errors.account && (
            <p className="text-red-500 text-xs mt-1">{errors.account}</p>
          )}
          {checkMessage && accountCheckStatus === "error" && (
            <p className="text-red-500 text-xs mt-1">{checkMessage}</p>
          )}
        </div>
        <div className="mb-6">
          <input
            name="amount"
            placeholder="Сумма"
            className={`border ${
              errors.amount ? "border-red-500" : "border-gray-300"
            } w-full pl-4 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            value={formData.amount || ""}
            onChange={handleChange}
            aria-label="Сумма"
            disabled={isLoading || isSuccess || (service?.categoryId === 7 && isAmountAutoFilled)}
            required
          />
          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
          )}
          {checkMessage && accountCheckStatus === "success" && (
            <p className={`text-${service?.categoryId === 7 ? "green" : "gray"}-500 text-xs mt-1`}>
              {checkMessage}
            </p>
          )}
        </div>
        {isSuccess && (
          <div className="text-center mb-4 text-green-500">Платеж успешно создан!</div>
        )}
        {errors.submit && (
          <div className="text-center mb-4 text-red-500">{errors.submit}</div>
        )}
        <div className="text-center">
          <button
            type="submit"
            className={`bg-blue-500 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-600 transition duration-200 flex items-center justify-center w-full ${
              isLoading || isSuccess || accountCheckStatus !== "success"
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            disabled={isLoading || isSuccess || accountCheckStatus !== "success"}
          >
            {isLoading ? (
              <div className="spinner w-4 h-4 border-4 border-t-transparent border-blue-600 rounded-full animate-spin"></div>
            ) : (
              "Оплатить"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const ServicesClient = ({ services }: { services: Service[] }) => {
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "1";

  const openForm = async (serviceId: number) => {
    try {
      const token = searchParams.get("token");
      if (!token) {
        console.error("Токен отсутствует в URL");
        throw new Error("Токен отсутствует в URL");
      }

      const response = await fetch(
        `https://widgetapi.hgg.kz/Api/GetServiceById?serviceId=${serviceId}`,
        {
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка HTTP: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
      }

      const data: Service = await response.json();
      console.log("Загружен сервис:", data);
      setSelectedService(data);
      setIsFormOpen(true);
    } catch (error) {
      console.error("Ошибка при загрузке данных сервиса:", error);
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = service.categoryId === parseInt(categoryId);
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <div className="relative flex flex-col gap-4">
        <div className="w-full max-w-md mx-auto mb-4 md:ml-0 md:mr-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск сервисов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 bg-white"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>
        <div
          className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,133px)] gap-4 auto-rows-min transition-all duration-700 ease-in-out ${
            isFormOpen ? "md:mr-96" : ""
          }`}
        >
          {filteredServices.map((service, index) => (
            <div
              key={`${service.id}-${index}`}
              className="relative w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] md:w-[140px] md:h-[140px] rounded-xl bg-muted/50 flex flex-col items-center justify-center text-xs cursor-pointer p-0 group transform transition-transform duration-300 hover:scale-105 will-change-transform"
              onClick={() => openForm(service.id)}
              title={`${service.name}: ${service.description}`}
            >
              <img
                src={`/img/service/${service.iconUrl}`}
                alt={service.name}
                className="w-8 h-8 sm:w-10 sm:h-10 mb-2"
              />
              <span className="font-semibold text-[10px] sm:text-xs text-center">{service.name}</span>
            </div>
          ))}
        </div>
      </div>
      <CheckoutForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        service={selectedService}
      />
    </>
  );
};

export default ServicesClient;