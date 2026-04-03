import { streamText, convertToModelMessages, UIMessage } from "ai"
import { createGroq } from "@ai-sdk/groq"

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

type ValidModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "claude-3-5-sonnet"
  | "groq-llama-3.3-70b"
  | "groq-llama-3.1-8b"
  | "groq-mixtral-8x7b"

function getModel(modelKey: string) {
  switch (modelKey) {
    case "groq-llama-3.3-70b":
      return groq("llama-3.3-70b-versatile")
    case "groq-llama-3.1-8b":
      return groq("llama-3.1-8b-instant")
    case "groq-mixtral-8x7b":
      return groq("mixtral-8x7b-32768")
    case "gpt-4o":
      return "openai/gpt-4o"
    case "claude-3-5-sonnet":
      return "anthropic/claude-3-5-sonnet-20241022"
    case "gpt-4o-mini":
    default:
      return "openai/gpt-4o-mini"
  }
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
  const model = getModel(modelKey)

  const result = streamText({
    model: model as any,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
  })

  return result.toUIMessageStreamResponse()
}
