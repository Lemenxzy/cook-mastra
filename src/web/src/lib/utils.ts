import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(timestamp: number): string {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diff = now.getTime() - messageTime.getTime();

  // 如果是今天
  if (diff < 24 * 60 * 60 * 1000) {
    return messageTime.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 如果是昨天
  if (diff < 48 * 60 * 60 * 1000) {
    return '昨天 ' + messageTime.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 其他日期
  return messageTime.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function getApiBaseUrl(): string {
  const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_NODE_ENV === "development";
  
  if (isDevelopment) {
    return import.meta.env.VITE_LOCAL_FETCH_URL || 'http://localhost:4112';
  } else {
    return import.meta.env.VITE_FETCH_URL || '';
  }
}