export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
  interval?: 'month' | 'year'
  features: string[]
  limits: {
    generationsPerMonth: number | null // null = unlimited
  }
}

export const PRODUCTS: Product[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out AdgenXai',
    priceInCents: 0,
    features: [
      '10 generations per month',
      'GPT-4o Mini model',
      'Live preview',
      'Code export',
    ],
    limits: {
      generationsPerMonth: 10,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professional developers',
    priceInCents: 2000, // $20/month
    interval: 'month',
    features: [
      '500 generations per month',
      'All AI models',
      'Version history',
      'Priority support',
    ],
    limits: {
      generationsPerMonth: 500,
    },
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'For power users and teams',
    priceInCents: 5000, // $50/month
    interval: 'month',
    features: [
      'Unlimited generations',
      'All AI models',
      'Priority access',
      'Early feature access',
    ],
    limits: {
      generationsPerMonth: null, // unlimited
    },
  },
]

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}

export function getProductLimit(planId: string): number | null {
  const product = getProductById(planId)
  return product?.limits.generationsPerMonth ?? 10
}
