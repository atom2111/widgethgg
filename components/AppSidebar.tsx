"use client";

import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { useSearchParams, useRouter } from "next/navigation";

interface Category {
  Id: number;
  Name: string;
  IconUrl: string | null; // Учитываем, что IconUrl может быть null
  OrderId: number;
}

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(
      "https://widgetapi.hgg.kz/Api/GetCategory",
      {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true", // Пропускаем предупреждение ngrok
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Ошибка при загрузке категорий: ${res.status} ${res.statusText}`);
    }

    const text = await res.text(); // Получаем тело ответа как текст
    try {
      const data = JSON.parse(text); // Пробуем парсить как JSON
      
      return data;
    } catch (parseError) {
      console.error("Ответ не является валидным JSON:", text);
      throw new Error("Сервер вернул не JSON-ответ");
    }
  } catch (error) {
    console.error("Ошибка в getCategories:", error);
    return [];
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    const fetchCategories = async () => {
      const data = await getCategories();
      console.log("Categories from API:", data);
      setCategories(data);
    };
    fetchCategories();

    // Если categoryId отсутствует, перенаправляем на categoryId=1
    if (!searchParams.get("categoryId")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("categoryId", "1");
      router.replace(`/services?${params.toString()}`);
    }
  }, [searchParams, router]);

  const createCategoryUrl = (categoryId: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("categoryId", categoryId.toString());
    return `/services?${params.toString()}`;
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border flex items-center justify-center">
        <span className="text-lg font-semibold">Категории</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.length === 0 ? (
                <p className="text-gray-500 text-center">Нет категорий</p>
              ) : (
                categories.map((category, index) => (
                  <SidebarMenuItem key={`${category.Id}-${index}`}>
                    <SidebarMenuButton asChild>
                      <a href={createCategoryUrl(category.Id)}>{category.Name}</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}