import * as Sentry from '@sentry/node'

import { Book } from '@/models/Book.js'

export const migrateBookAuthors = async (): Promise<void> => {
  try {
    const { modifiedCount } = await Book.collection.updateMany({ autor: { $exists: true } }, [
      { $set: { authors: { $ifNull: ['$authors', ['$autor']] } } },
      { $unset: 'autor' },
    ])
    if (await Book.collection.indexExists('autor_1')) await Book.collection.dropIndex('autor_1')
    if (modifiedCount > 0) console.log(`✅ ${modifiedCount} livro(s) com a lista de autores`)
  } catch (err) {
    console.error('❌ Erro ao mover o autor para a lista de autores:', err)
    Sentry.captureException(err, { tags: { boot: 'migrate-authors' } })
  }
}
