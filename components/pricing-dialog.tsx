"use client"

import { useState, useCallback, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { X, Check, Zap, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLANS, Plan } from "@/lib/plans"
import { UserSettings } from "@/lib/storage"
import { createCheckoutSession } from "@/app/actions/stripe"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PricingDialogProps {
  open: boolean
  onClose: () => void
  settings: UserSettings
  onSettingsChange: (settings: UserSettings) => void
}

export function PricingDialog({ open, onClose, settings, onSettingsChange }: PricingDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [checkoutDone, setCheckoutDone] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelectedPlan(null)
      setCheckoutDone(false)
    }
  }, [open])

  if (!open) return null

  if (checkoutDone) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-background" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">You&apos;re all set!</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Your {selectedPlan?.name} plan is now active. Enjoy your upgraded generation limits.
          </p>
          <button
            onClick={() => {
              onSettingsChange({ ...settings, planId: selectedPlan?.id as any })
              onClose()
            }}
            className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start building
          </button>
        </div>
      </div>
    )
  }

  if (selectedPlan) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
          <div className="flex items-center gap-3 p-5 border-b border-border">
            <button
              onClick={() => setSelectedPlan(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Subscribe to {selectedPlan.name}
              </h2>
              <p className="text-xs text-muted-foreground">{selectedPlan.priceLabel}/month</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <CheckoutEmbed
              plan={selectedPlan}
              userId={settings.userId ?? "anonymous"}
              onSuccess={() => setCheckoutDone(true)}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground text-balance">Plans &amp; Pricing</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Get started for free. Upgrade for more generations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
          {PLANS.map((plan) => {
            const isCurrent = settings.planId === plan.id
            const isPopular = plan.id === "pro"
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border p-5 transition-colors",
                  isPopular
                    ? "border-foreground bg-card"
                    : "border-border bg-muted/30",
                  isCurrent && "opacity-70"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-[11px] font-semibold bg-foreground text-background rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-foreground">{plan.priceLabel}</span>
                    {plan.priceInCents > 0 && (
                      <span className="text-xs text-muted-foreground">/month</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="flex-1 space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2 text-center text-xs font-medium text-muted-foreground border border-border rounded-lg">
                    Current plan
                  </div>
                ) : plan.priceInCents === 0 ? (
                  <div className="w-full py-2 text-center text-xs font-medium text-muted-foreground border border-border rounded-lg">
                    Free forever
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className={cn(
                      "w-full py-2 rounded-lg text-xs font-semibold transition-opacity flex items-center justify-center gap-1.5",
                      isPopular
                        ? "bg-foreground text-background hover:opacity-90"
                        : "bg-muted border border-border text-foreground hover:bg-accent"
                    )}
                  >
                    <Zap className="w-3 h-3" />
                    Upgrade to {plan.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CheckoutEmbed({
  plan,
  userId,
  onSuccess,
}: {
  plan: Plan
  userId: string
  onSuccess: () => void
}) {
  const fetchClientSecret = useCallback(
    () => createCheckoutSession(plan.id as "pro" | "unlimited", userId),
    [plan.id, userId]
  )

  return (
    <EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{
        fetchClientSecret,
        onComplete: onSuccess,
      }}
    >
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  )
}
