export type Plan = {
  key: string
  name: string
  price: string
  priceYearly: string
  priceAmount: number
  priceYearlyAmount: number
  description: string
  icon: string
  highlight: boolean
  badge: string | null
  features: string[]
  cta: string
  priceId: string | null
  priceYearlyId: string | null
}

const PLAN_DEFINITIONS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 'R$ 199',
    priceYearly: 'R$ 1.990',
    priceAmount: 199,
    priceYearlyAmount: 1990,
    description: 'Ideal para oficinas que estão começando a organizar sua operação.',
    icon: 'i-lucide-wrench',
    highlight: false,
    badge: null,
    features: [
      'Ordens de serviço ilimitadas',
      'Cadastro de clientes e veículos',
      'Gestão financeira básica',
      'Relatórios essenciais',
      'Até 3 usuários',
      'Suporte por email'
    ],
    cta: 'Começar com Starter'
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'R$ 399',
    priceYearly: 'R$ 3.990',
    priceAmount: 399,
    priceYearlyAmount: 3990,
    description: 'Para oficinas que precisam de controle completo e escala.',
    icon: 'i-lucide-zap',
    highlight: true,
    badge: 'Mais popular',
    features: [
      'Tudo do Starter',
      'Usuários ilimitados',
      'Relatórios avançados e análises',
      'Integração fiscal',
      'Controle de estoque avançado',
      'Suporte prioritário'
    ],
    cta: 'Começar com Pro'
  }
] as const

export function usePlans() {
  const config = useRuntimeConfig()

  const plans: Plan[] = PLAN_DEFINITIONS.map(p => ({
    ...p,
    features: [...p.features],
    badge: p.badge ?? null,
    priceId: (config.public as Record<string, string>)[`stripe${p.key.charAt(0).toUpperCase() + p.key.slice(1)}PriceId`] || null,
    priceYearlyId: (config.public as Record<string, string>)[`stripe${p.key.charAt(0).toUpperCase() + p.key.slice(1)}PriceIdYearly`] || null
  }))

  function getPlanByPriceId(priceId: string | null | undefined): Plan | null {
    if (!priceId) return null
    return plans.find(p => p.priceId === priceId || p.priceYearlyId === priceId) ?? null
  }

  /** Shape esperada pelo BillingPricingPlans / UPricingPlan */
  function toCmsPlan(plan: Plan) {
    return {
      title: plan.name,
      description: plan.description,
      highlight: plan.highlight,
      scale: plan.highlight,
      badge: plan.badge ? { label: plan.badge } : undefined,
      button: { label: plan.cta },
      features: plan.features.map(f => ({ title: f })),
      price: {
        month: plan.price,
        year: plan.priceYearly
      },
      stripePriceId: {
        month: plan.priceId ?? '',
        year: plan.priceYearlyId ?? ''
      }
    }
  }

  return { plans, getPlanByPriceId, toCmsPlan }
}
