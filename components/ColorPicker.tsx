"use client";

import { useState } from "react";

export default function ColorPicker() {
    const [bgColor, setBgColor] = useState("#ffffff");

    return (
        <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg">
            <label className="text-lg font-semibold mr-2">Цвет фона:</label>
            <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-10 border-none cursor-pointer"
            />
            <style>{`body { background-color: ${bgColor}; }`}</style>
        </div>
    );
}
