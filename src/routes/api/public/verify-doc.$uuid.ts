import { createFileRoute } from '@tanstack/react-router'

/** Validation stricte de la référence transmise dans l'URL (anti-injection / anti-énumération). */
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,60}$/

export const Route = createFileRoute('/api/public/verify-doc/$uuid')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { uuid } = params as { uuid: string }

        if (!REFERENCE_RE.test(uuid)) {
          return Response.json(
            { status: 'NOT_FOUND', error: 'Référence invalide' },
            { status: 404, headers: { 'Cache-Control': 'no-store' } },
          )
        }

        try {
          const {
            verifyByReference,
            verifyByToken,
            logVerification,
            isRateLimited,
          } = await import('@/lib/certification/certification.server')

          const url = new URL(request.url)
          const token = url.searchParams.get('t')
          const ip =
            request.headers.get('cf-connecting-ip') ??
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            null
          const userAgent = request.headers.get('user-agent')

          if (await isRateLimited(ip)) {
            return Response.json(
              { status: 'RATE_LIMITED', error: 'Trop de vérifications, réessayez plus tard.' },
              { status: 429, headers: { 'Cache-Control': 'no-store' } },
            )
          }

          // Le segment d'URL peut être soit un jeton d'authenticité, soit une
          // référence de document (QR historiques). On tente d'abord le jeton.
          let result = await verifyByToken(token ?? uuid)
          let usedToken = true
          if (result.status === 'INVALID' && !token) {
            result = await verifyByReference(uuid)
            usedToken = false
          }

          await logVerification({
            reference: usedToken ? null : uuid,
            result: result.status,
            ip,
            userAgent,
          })

          // INVALID = aucun document correspondant -> 404 explicite, sans données inventées.
          if (result.status === 'INVALID') {
            return Response.json(
              { status: 'NOT_FOUND', error: 'Document non trouvé' },
              { status: 404, headers: { 'Cache-Control': 'no-store' } },
            )
          }

          const doc = result.document
          return Response.json(
            {
              status: result.status,
              reason: 'reason' in result ? result.reason ?? null : null,
              docType: doc.docType,
              reference: doc.reference,
              date: doc.date,
              client_nom: doc.client_nom,
              representant_nom: doc.representant_nom ?? null,
              montant: doc.montant,
              statut_document: doc.statut_document ?? null,
              certification_id: doc.certification_id ?? null,
              certified_at: doc.certified_at ?? null,
              canonical_hash: doc.canonical_hash ?? null,
              signature_algorithm: doc.signature_algorithm ?? null,
              checked_at: new Date().toISOString(),
            },
            { status: 200, headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (error) {
          // Erreur technique : distincte d'un document introuvable, journalisée côté serveur.
          console.error('[verify-doc] erreur de vérification', uuid, error)
          return Response.json(
            { status: 'ERROR', error: 'Vérification temporairement indisponible' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
          )
        }
      },
    },
  },
})
