"use client";

import { useEffect, useState } from "react";

export default function GalleryPage() {
  const [htmlContent, setHtmlContent] = useState<string>("");

  useEffect(() => {
    // 获取 HTML 内容
    fetch("/gallery/page-route")
      .then((response) => response.text())
      .then((html) => setHtmlContent(html))
      .catch((error) => console.error("Error loading HTML:", error));
  }, []);

  if (!htmlContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 使用 dangerouslySetInnerHTML 渲染 HTML
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: htmlContent,
      }}
    />
  );
}