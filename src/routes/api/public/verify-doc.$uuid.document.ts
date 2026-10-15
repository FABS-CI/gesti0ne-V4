import { createFileRoute } from '@tanstack/react-router'

/** Même validation stricte que la vérification publique. */
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,60}$/

export const Route = createFileRoute('/api/public/verify-doc/$uuid/document')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { uuid } = params as { uuid: string }
        if (!REFERENCE_RE.test(uuid)) {
          return Response.json(
            { error: 'Référence invalide' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } },
          )
        }

        try {
          const { isRateLimited } = await import('@/lib/certification/certification.server')
          const { loadPublicPdfPayload } = await import(
            '@/lib/certification/public-document.server'
          )

          const ip =
            request.headers.get('cf-connecting-ip') ??
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            null
          if (await isRateLimited(ip)) {
            return Response.json(
              { error: 'Trop de requêtes, réessayez plus tard.' },
              { status: 429, headers: { 'Cache-Control': 'no-store' } },
            )
          }

          const token = new URL(request.url).searchParams.get('t')
          const payload = await loadPublicPdfPayload(uuid, token)

          // Aucun document authentique téléchargeable -> pas de données.
          if (!payload) {
            return Response.json(
              { error: 'Document indisponible' },
              { status: 404, headers: { 'Cache-Control': 'no-store' } },
            )
          }

          // Thème du récap (purement visuel), lu côté serveur ; bleu par défaut.
          let recapTheme: unknown = null
          try {
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
            const { data } = await supabaseAdmin
              .from('document_theme_settings')
              .select('theme_global, theme_par_type')
              .eq('id', 1)
              .maybeSingle()
            recapTheme = data ?? null
          } catch {
            recapTheme = null
          }

          return Response.json({ ...payload, recapTheme }, {
            status: 200,
            headers: { 'Cache-Control': 'no-store' },
          })
        } catch (error) {
          console.error('[verify-doc/document] erreur', uuid, error)
          return Response.json(
            { error: 'Téléchargement temporairement indisponible' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
          )
        }
      },
    },
  },
})
