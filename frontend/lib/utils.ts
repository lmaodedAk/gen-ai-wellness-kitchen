import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

export function freshnessColor(status: string) {
  switch (status) {
    case 'expired':  return 'bg-red-100 text-red-700 border-red-200'
    case 'expiring': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'use_soon': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default:         return 'bg-green-100 text-green-700 border-green-200'
  }
}
