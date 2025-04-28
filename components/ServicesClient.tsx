"use client";

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

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

// Generate a random 12-digit transaction ID
const generateTransactionId = (): string => {
  return Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join('');
};

const CheckoutForm = ({ isOpen, onClose, service }: CheckoutFormProps) => {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string>('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

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
      setCheckMessage('');
    }
  }, [service]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'account') {
      setCheckMessage('');
    }
  };

  const handleAmountFocus = async () => {
    if (!formData.account?.trim()) {
      setErrors({ account: "Account is required" });
      return;
    }

    if (!token) {
      setErrors({ submit: "Token is missing in URL" });
      return;
    }

    try {
      setIsLoading(true);
      const sessionIdResponse = await fetch(
        `https://widgetapipayment.hgg.kz/api/payment/get-session?token=${token}`
      );
      if (!sessionIdResponse.ok) throw new Error("Failed to get sessionId");
      const { sessionId } = await sessionIdResponse.json();

      const checkData = {
        token: token,
        sessionId: sessionId,
        transactionId: generateTransactionId(),
        service: String(service?.id || ""),
        amount: "0", // Amount not required for check
        account: String(formData.account),
        additionalParams: Object.fromEntries(
          (service?.additionalParameters || []).map((param) => [
            param.name,
            String(formData[param.name] || ""),
          ])
        ),
      };

      const checkResponse = await fetch(
        "https://widgetapipayment.hgg.kz/api/payment/account-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(checkData),
        }
      );

      if (!checkResponse.ok) {
        const errorData = await checkResponse.json();
        throw new Error(errorData.message || "Account check failed");
      }

      const checkResult = await checkResponse.json();

      if (service?.categoryId === 7) {
        // For categoryId=7, set the OrderAmount
        if (checkResult.TransactionContent?.Extras) {
          const orderAmount = checkResult.TransactionContent.Extras.find(
            (extra: any) => extra.fieldName === "OrderAmount"
          )?.fieldValue;
          if (orderAmount) {
            setFormData(prev => ({ ...prev, amount: orderAmount }));
          }
        }
      } else {
        // For other categories
        if (checkResult.ResponseStatus !== "10") {
          setCheckMessage(checkResult.Message || "Account check failed");
        } else {
          setCheckMessage('');
        }
      }
    } catch (error) {
      setCheckMessage(
        error instanceof Error ? error.message : "Account check failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const validate = () => {
    let tempErrors: FormErrors = {};
    const fields = [
      ...(service?.additionalParameters || []),
      { name: "account", description: "Account", regex: ".*" },
      { name: "amount", description: "Amount", regex: "^[0-9]+$" },
    ];

    fields.forEach((param) => {
      if (!formData[param.name]?.trim()) {
        tempErrors[param.name] = `${param.description} is required`;
      } else if (!new RegExp(param.regex).test(formData[param.name])) {
        tempErrors[param.name] = `Invalid ${param.description} format`;
      }
    });

    return tempErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkMessage) {
      setErrors({ submit: checkMessage });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length !== 0) {
      setErrors(validationErrors);
      return;
    }

    if (!token) {
      setErrors({ submit: "Token is missing in URL" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const sessionIdResponse = await fetch(
        `https://widgetapipayment.hgg.kz/api/payment/get-session?token=${token}`
      );
      if (!sessionIdResponse.ok) throw new Error("Failed to get sessionId");
      const { sessionId } = await sessionIdResponse.json();

      const paymentData = {
        token: token,
        sessionId: sessionId,
        service: String(service?.id || ""),
        amount: String(formData.amount),
        account: String(formData.account),
        additionalParams: Object.fromEntries(
          (service?.additionalParameters || []).map((param) => [
            param.name,
            String(formData[param.name] || ""),
          ])
        ),
      };

      const paymentResponse = await fetch(
        "https://widgetapipayment.hgg.kz/api/payment/create-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentData),
        }
      );

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.message || "Payment creation failed");
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
        submit:
          error instanceof Error
            ? error.message
            : "Failed to create payment",
      });
    }
  };

  if (!service) return null;

  return (
    <div
      className={`fixed z-50 w-full md:w-96 bg-white shadow-lg p-0 md:p-6 transition-all duration-700 ease-in-out overflow-y-auto left-0 right-0 md:left-auto md:right-0 ${
        isOpen
          ? "bottom-0 h-[600px] opacity-100 md:top-0 md:h-full md:bottom-auto"
          : "bottom-[-600px] h-0 opacity-0 md:top-0 md:right-[-384px] md:h-full md:bottom-auto"
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
        <div className="mb-4">
          <input
            name="account"
            placeholder="Account"
            className={`border ${
              errors.account ? "border-red-500" : "border-gray-300"
            } w-full pl-4 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            value={formData.account || ""}
            onChange={handleChange}
            aria-label="Account"
            disabled={isLoading || isSuccess}
          />
          {errors.account && (
            <p className="text-red-500 text-xs mt-1">{errors.account}</p>
          )}
        </div>
        <div className="mb-6">
          <input
            name="amount"
            placeholder="Amount"
            className={`border ${
              errors.amount ? "border-red-500" : "border-gray-300"
            } w-full pl-4 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
            value={formData.amount || ""}
            onChange={handleChange}
            onFocus={handleAmountFocus}
            aria-label="Amount"
            disabled={isLoading || isSuccess || service.categoryId === 7}
          />
          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
          )}
          {checkMessage && (
            <p className="text-red-500 text-xs mt-1">{checkMessage}</p>
          )}
        </div>
        <div className="relative">
          {isSuccess ? (
            <div className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13 l4 4L19 7"
                />
              </svg>
              <span>Payment created</span>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 disabled:bg-blue-400 flex items-center justify-center"
              disabled={isLoading || !!checkMessage}
            >
              {isLoading ? (
                <svg
                  className="animate-spin h-5 w-5 mr-2"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : null}
              {isLoading ? "Processing..." : "Pay"}
            </button>
          )}
        </div>
        {errors.submit && (
          <p className="text-red-500 text-xs mt-2 text-center">{errors.submit}</p>
        )}
        {!isSuccess && (
          <>
            <div className="mt-4 text-center text-gray-500 text-xs">
              <p>Payment recommendation</p>
            </div>
            <div className="mt-4 text-left text-gray-500 text-xs">
              <ul className="list-disc list-inside">
                <li>Verify entered data</li>
                <br />
                <li>Click "Pay" button</li>
                <br />
              </ul>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

const ServicesClient = ({ services }: { services: Service[] }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "1";

  const openForm = async (serviceId: number) => {
    try {
      const token = searchParams.get("token");
      if (!token) {
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
        throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
      }
  
      const text = await response.text();
      try {
        const data: Service = JSON.parse(text);
        setSelectedService(data);
        setIsFormOpen(true);
      } catch (parseError) {
        console.error("Ответ не является валидным JSON:", text);
        throw new Error("Сервер вернул не JSON-ответ");
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных сервиса:", error);
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
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
              className="relative w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] md:w-[145px] md:h-[145px] rounded-xl bg-muted/50 flex flex-col items-center justify-center text-xs cursor-pointer p-0 group transform transition-transform duration-300 hover:scale-105 will-change-transform"
              onClick={() => openForm(service.id)}
              title={`${service.name}: ${service.description}`}
            >
              <img
                src={`/img/service/${service.iconUrl}`}
                alt={service.name}
                className="w-8 h-8 sm:w-10 sm:h-10 mb-2"
              />
              <span className="font-semibold text-[10px] sm:text-xs text-center">
                {service.name}
              </span>
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