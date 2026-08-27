import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual, createHash } from 'node:crypto'
import { substackPost, substackNote } from '@/lib/agent-tools.server'

function authorized(request: Request): boolean {
  const secret = process.env['PUBLISH_TRIGGER_TOKEN']
  if (!secret) return false
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get('authorization') ?? '')
  if (!match?.[1]) return false
  const digest = (v: string) => createHash('sha256').update(v, 'utf8').digest()
  return timingSafeEqual(digest(match[1]), digest(secret))
}

export const Route = createFileRoute('/api/public/publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return new Response('Unauthorized', { status: 401 })
        }
        let payload: { kind?: string; title?: string; subtitle?: string; body?: string; sendEmail?: boolean }
        try {
          payload = await request.json()
        } catch {
          return Response.json({ error: 'invalid json' }, { status: 400 })
        }
        const result =
          payload.kind === 'note'
            ? await substackNote(String(payload.body ?? ''))
            : await substackPost(
                String(payload.title ?? ''),
                String(payload.subtitle ?? ''),
                String(payload.body ?? ''),
                Boolean(payload.sendEmail),
              )
        return Response.json(result, { status: result.ok ? 200 : 502 })
      },
    },
  },
})
