import * as Sentry from '@sentry/node'

import { DEFAULT_PERMISSIONS } from '@/constants/index.js'
import { Permission } from '@/models/Permission.js'

export const seedPermissions = async (): Promise<void> => {
  try {
    const count = await Permission.countDocuments()

    if (count >= DEFAULT_PERMISSIONS.length) {
      console.log('✅ Permissões já inicializadas')
      return
    }

    await Promise.all(
      DEFAULT_PERMISSIONS.map(({ role, resource, actions }) =>
        Permission.updateOne(
          { role, resource },
          { $setOnInsert: { role, resource, actions } },
          { upsert: true },
        ),
      ),
    )

    console.log('✅ Permissões padrão criadas')
  } catch (err) {
    console.error('❌ Erro ao inicializar permissões:', err)
    Sentry.captureException(err, { tags: { boot: 'seed' } })
  }
}
