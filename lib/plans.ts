export interface Plan {
  id: "free" | "pro" | "unlimited"
  name: string
  description: string
  priceInCents: number
  priceLabel: string
  stripePriceId: string | null
  generationsPerMonth: number | null
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started for free",
    priceInCents: 0,
    priceLabel: "$0",
    stripePriceId: null,
    generationsPerMonth: 10,
    features: [
      "10 generations / month",
      "GPT-4o Mini model",
      "Code preview & export",
      "Chat history",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For power builders",
    priceInCents: 2000,
    priceLabel: "$20",
    stripePriceId: "price_1THwLHBskanfOG4nDCJKj5Ba",
    generationsPerMonth: 500,
    features: [
      "500 generations / month",
      "All models (GPT-4o, Grok, Claude)",
      "Code preview & export",
      "Priority support",
    ],
  },
  {
    id: "unlimited",
    name: "Unlimited",
    description: "For serious teams",
    priceInCents: 5000,
    priceLabel: "$50",
    stripePriceId: "price_1THwLSBskanfOG4n3F88AcH4",
    generationsPerMonth: null,
    features: [
      "Unlimited generations",
      "All models (GPT-4o, Grok, Claude)",
      "Code preview & export",
      "Priority support & SLA",
    ],
  },
]
