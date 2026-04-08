export const ROLES = ['admin', 'editor', 'viewer'] as const
export const RESOURCES = ['books', 'users', 'subgeneros', 'permissions'] as const
export const ACTIONS = ['create', 'read', 'update', 'delete'] as const

/** Permissões padrão aplicadas ao seed inicial do banco */
export const DEFAULT_PERMISSIONS = [
  // admin — acesso total a tudo (configurável depois)
  { role: 'admin', resource: 'books',       actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'users',       actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'subgeneros',  actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'permissions', actions: ['create', 'read', 'update', 'delete'] },

  // editor — lê e edita livros e sub-gêneros, lê usuários
  { role: 'editor', resource: 'books',      actions: ['create', 'read', 'update'] },
  { role: 'editor', resource: 'users',      actions: ['read'] },
  { role: 'editor', resource: 'subgeneros', actions: ['read'] },
  { role: 'editor', resource: 'permissions',actions: [] },

  // viewer — somente leitura
  { role: 'viewer', resource: 'books',      actions: ['read'] },
  { role: 'viewer', resource: 'users',      actions: [] },
  { role: 'viewer', resource: 'subgeneros', actions: ['read'] },
  { role: 'viewer', resource: 'permissions',actions: [] },
] as const
