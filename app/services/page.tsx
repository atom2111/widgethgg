import { AppSidebar } from "../../components/AppSidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Home } from "lucide-react";
import ServicesClient from "../../components/ServicesClient";
import jwt from "jsonwebtoken";
import { unstable_noStore } from "next/cache"; // Импортируем unstable_noStore

interface Service {
  id: number;
  name: string;
  iconUrl: string;
  categoryId: number;
  description: string;
}

interface Category {
  Id: number;
  Name: string;
  IconUrl: string;
  OrderId: number;
}

async function getServices(agentId: string): Promise<Service[]> {
  try {
    console.log(`Fetching services for agentId: ${agentId}`);
    const res = await fetch(
      `https://widgetapipayment.hgg.kz/api/payment/get-agent-services?agentId=${agentId}`,
      {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.error(`Failed to fetch services: ${res.status} ${res.statusText}`);
      throw new Error(`Ошибка при загрузке сервисов: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    
    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error('Ошибка в getServices:', error);
    return [];
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    
    const res = await fetch('https://widgetapi.hgg.kz/Api/GetCategory', {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error(`Failed to fetch categories: ${res.status} ${res.statusText}`);
      throw new Error(`Ошибка при загрузке категорий: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error('Ошибка в getCategories:', error);
    return [];
  }
}

function decodeToken(token: string): { agentId: string; userId: string; sessionId: string } | null {
  try {
    const secret = "your-secret-key-here-32-chars-long";
    const decoded = jwt.verify(token, secret) as { agentId: string; userId: string; sessionId: string };
    return decoded;
  } catch (error) {
    console.error("Ошибка декодирования токена:", error);
    return null;
  }
}

export default async function ServicesPage({ 
  searchParams 
}: { 
  searchParams: { 
    token?: string; 
    categoryId?: string;
    serviceId?: string;
  } 
}) {
  unstable_noStore(); // Указываем, что страница динамическая и не должна кэшироваться

  const { token, categoryId, serviceId } = await searchParams;

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500 text-lg font-semibold">Ошибка: токен не указан</p>
      </div>
    );
  }

  const decodedToken = decodeToken(token);
  if (!decodedToken) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500 text-lg font-semibold">Ошибка: недействительный токен</p>
      </div>
    );
  }

  const { agentId } = decodedToken;

  const services: Service[] = await getServices(agentId);
  const categories: Category[] = await getCategories();
  
  const currentCategory = categoryId 
    ? categories.find(cat => cat.Id === parseInt(categoryId))
    : categories[0];
  
  const currentService = serviceId 
    ? services.find(service => service.id === parseInt(serviceId))
    : null;

  const firstCategoryId = categories.length > 0 ? categories[0].Id : 1;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 z-10 backdrop-blur-md bg-opacity-100">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="flex-1 overflow-hidden">
            <BreadcrumbList className="flex flex-wrap items-center gap-1 text-sm md:text-base">
              <BreadcrumbItem>
                <BreadcrumbLink 
                  href={`/services?token=${token}&categoryId=${firstCategoryId}`} 
                  className="flex items-center gap-1"
                >
                  <Home className="w-4 h-4 md:hidden" />
                  <span className="hidden md:inline">Сервисы</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {currentCategory && (
                <>
                  <BreadcrumbSeparator className="w-4 h-4" />
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      href={`/services?token=${token}&categoryId=${currentCategory.Id}`}
                      className="truncate"
                    >
                      {currentCategory.Name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              {currentService && (
                <>
                  <BreadcrumbSeparator className="w-4 h-4" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="truncate">
                      {currentService.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-background">
          <ServicesClient services={services} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}