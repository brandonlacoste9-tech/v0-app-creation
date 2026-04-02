import { streamText, convertToModelMessages, UIMessage } from "ai"

const VALID_MODELS = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"] as const
type ValidModel = (typeof VALID_MODELS)[number]

const MODEL_MAP: Record<ValidModel, string> = {
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
}

export async function POST(req: Request) {
  const { messages, model = "gpt-4o-mini" }: { messages: UIMessage[]; model?: string } =
    await req.json()

  const validModel = VALID_MODELS.includes(model as ValidModel)
    ? (model as ValidModel)
    : "gpt-4o-mini"

  const systemPrompt = `You are v0, Vercel's AI-powered UI code generation assistant. 
You specialize in generating React/Next.js components using Tailwind CSS and shadcn/ui.

When a user asks you to build something:
1. Respond with a brief explanation of what you're building (1-2 sentences max)
2. Then output a SINGLE self-contained React component wrapped in a markdown code block with the language "tsx"
3. The component should use Tailwind CSS classes for styling
4. Import from shadcn/ui components when appropriate: Button, Card, Input, etc.
5. Make it functional and visually polished with a dark theme by default
6. Export the component as the default export named "Component"

Example response format:
I'll create a modern dashboard card component with stats.

\`\`\`tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Component() {
  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white">
      ...
    </Card>
  )
}
\`\`\`

Keep components focused, beautiful, and production-ready. Use realistic placeholder data.`

  const result = streamText({
    model: MODEL_MAP[validModel],
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
  })

  return result.toUIMessageStreamResponse()
}
