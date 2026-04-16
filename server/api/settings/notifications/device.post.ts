import { requireAuthUser } from '../../../utils/require-auth'

export default defineEventHandler(async (event) => {
  await requireAuthUser(event)
  const body = await readBody(event)

  return {
    ok: true,
    receivedAt: new Date().toISOString(),
    device: body ?? null
  }
})
