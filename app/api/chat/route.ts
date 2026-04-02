import { streamText, convertToModelMessages, UIMessage } from "ai"

const VALID_MODELS = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"] as const
type ValidModel = (typeof VALID_MODELS)[number]

const MODEL_MAP: Record<ValidModel, string> = {
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
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

  // AI SDK 6 DefaultChatTransport sends { messages: UIMessage[] }
  const messages: UIMessage[] = Array.isArray(body.messages) ? body.messages : []

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const modelKey = (body.model ?? "gpt-4o-mini") as string
  const validModel: ValidModel = VALID_MODELS.includes(modelKey as ValidModel)
    ? (modelKey as ValidModel)
    : "gpt-4o-mini"

  const result = streamText({
    model: MODEL_MAP[validModel],
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
  })

  return result.toUIMessageStreamResponse()
}
