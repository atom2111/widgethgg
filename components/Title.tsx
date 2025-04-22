import React from "react";

interface TitleProps {
  children: React.ReactNode;
  textColor?: string; // Цвет текста
  bgColor?: string; // Цвет фона
}

const Title: React.FC<TitleProps> = ({
  children,
  textColor = "text-white",
  bgColor = "bg-black",
}) => {
  return (
    <h2 className={`text-3xl font-bold mb-4 text-center p-4 rounded-lg ${textColor} ${bgColor}`}>
      {children}
    </h2>
  );
};

export default Title;
