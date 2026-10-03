import * as Sentry from '@sentry/node'

import { Book } from '@/models/Book.js'

export const removeBookGoogleId = async (): Promise<void> => {
  try {
    const { modifiedCount } = await Book.collection.updateMany(
      { google_books_id: { $exists: true } },
      { $unset: { google_books_id: '' } },
    )
    if (await Book.collection.indexExists('google_books_id_1'))
      await Book.collection.dropIndex('google_books_id_1')
    if (modifiedCount > 0) console.log(`✅ ${modifiedCount} livro(s) sem o código do Google Books`)
  } catch (err) {
    console.error('❌ Erro ao tirar o código do Google Books dos livros:', err)
    Sentry.captureException(err, { tags: { boot: 'migrate-google-id' } })
  }
}
