"use client";

import { useMemo } from "react";
import { appPath } from "@artduo/contracts";
import type { CreateHandwritingJob, HandwritingJob, HandwritingOptions } from "@artduo/contracts";
import type { HandwritingProvider } from "@artduo/ui";

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(appPath(url), { ...init, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } }); }
  catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("连接暂时中断，输入已保留，可以重试。");
  }
  let body;
  try { body = await response.json(); } catch { throw new Error("暂时无法读取制作进度，可以稍后重试。"); }
  if (!response.ok) throw new Error(body.message ?? "手写服务暂时不可用，输入已保留。");
  return body;
}
export function useHandwrittenKeepsake(): HandwritingProvider {
  return useMemo(() => ({
    options: (signal?: AbortSignal) => request<HandwritingOptions>("/api/handwriting/options", { signal }),
    create: (input: CreateHandwritingJob, signal?: AbortSignal) => request<HandwritingJob>("/api/handwriting/jobs", { method: "POST", body: JSON.stringify(input), signal }),
    get: (id: string, signal?: AbortSignal) => request<HandwritingJob>(`/api/handwriting/jobs/${encodeURIComponent(id)}`, { signal }),
    cancel: (id: string) => request<HandwritingJob>(`/api/handwriting/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  }), []);
}
