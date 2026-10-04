import * as Sentry from '@sentry/node'

import { Book } from '@/models/Book.js'
import { Permission } from '@/models/Permission.js'

export const removeBulkSearchMarks = async (): Promise<void> => {
  try {
    const { modifiedCount } = await Book.collection.updateMany(
      { $or: [{ enriched_at: { $exists: true } }, { manually_edited_at: { $exists: true } }] },
      { $unset: { enriched_at: '', manually_edited_at: '' } },
    )
    const { deletedCount } = await Permission.deleteMany({ resource: 'enrichment' })
    if (modifiedCount || deletedCount)
      console.log(
        `✅ Busca em lote: ${modifiedCount} livro(s) e ${deletedCount} permissão(ões) limpos`,
      )
  } catch (err) {
    console.error('❌ Erro ao limpar o que a busca em lote deixou:', err)
    Sentry.captureException(err, { tags: { boot: 'migrate-bulk-search' } })
  }
}
