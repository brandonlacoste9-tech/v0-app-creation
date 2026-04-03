import { streamText, convertToModelMessages, UIMessage } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { neon } from "@neondatabase/serverless"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const sql = neon(process.env.DATABASE_URL!)

function getModel(modelKey: string) {
  switch (modelKey) {
    case "groq-llama-3.3-70b":
      return groq("llama-3.3-70b-versatile")
    case "groq-llama-3.1-8b":
      return groq("llama-3.1-8b-instant")
    case "groq-mixtral-8x7b":
      return groq("mixtral-8x7b-32768")
    case "grok-2":
      return "xai/grok-2"
    case "grok-3-mini":
      return "xai/grok-3-mini"
    case "gpt-4o":
      return "openai/gpt-4o"
    case "claude-3-5-sonnet":
      return "anthropic/claude-3-5-sonnet-20241022"
    case "gpt-4o-mini":
    default:
      return "openai/gpt-4o-mini"
  }
}

async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; used: number; planId: string }> {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Ensure user row exists (upsert with default free plan)
  await sql`INSERT INTO users (id) VALUES (${userId}) ON CONFLICT (id) DO NOTHING`

  const users = await sql`SELECT plan_id FROM users WHERE id = ${userId}`
  const planId: string = users[0]?.plan_id ?? "free"

  if (planId === "unlimited") return { allowed: true, used: 0, planId }

  const limit = planId === "pro" ? 500 : 10
  const usage = await sql`SELECT generations_used FROM usage WHERE user_id = ${userId} AND month = ${monthKey}`
  const used = Number(usage[0]?.generations_used ?? 0)

  if (used >= limit) return { allowed: false, used, planId }

  await sql`
    INSERT INTO usage (user_id, month, generations_used)
    VALUES (${userId}, ${monthKey}, 1)
    ON CONFLICT (user_id, month) DO UPDATE SET generations_used = usage.generations_used + 1
  `

  return { allowed: true, used: used + 1, planId }
}

const systemPrompt = `You are adgenai, an AI-powered UI code generation assistant.
You specialize in generating React/Next.js components using Tailwind CSS.

When a user asks you to build something:
1. Respond with a brief explanation of what you're building (1-2 sentences max)
2. Then output a SINGLE self-contained React component wrapped in a markdown code block with the language "tsx"
3. The component must use Tailwind CSS classes for styling
4. Make it functional and visually polished with a dark theme by default
5. Export the component as default, named "Component"

Example response format:
Here's a modern pricing card component.

\`\`\`tsx
export default function Component() {
  return (
    <div className="bg-zinc-900 text-white p-6 rounded-xl">
      ...
    </div>
  )
}
\`\`\`

Keep components focused, beautiful, and production-ready. Use realistic placeholder data.`

export async function POST(req: Request) {
  const body = await req.json()

  const messages: UIMessage[] = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Usage gating
  const userId = body.userId as string | undefined
  if (userId) {
    const { allowed, planId } = await checkAndIncrementUsage(userId)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "generation_limit_reached", planId }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      )
    }
  }

  const modelKey = (body.model ?? "gpt-4o-mini") as string
  const model = getModel(modelKey)

  const result = streamText({
    model: model as any,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
  })

  return result.toUIMessageStreamResponse()
}
