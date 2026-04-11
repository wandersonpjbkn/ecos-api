export const ROLES = ['admin', 'editor', 'viewer'] as const

export const RESOURCES = [
  'books',
  'users',
  'autores',
  'midias',
  'categorias',
  'subgeneros',
  'permissions',
] as const

export const ACTIONS = ['create', 'read', 'update', 'delete'] as const

/** Permissões padrão aplicadas ao seed inicial do banco */
export const DEFAULT_PERMISSIONS = [
  // ── admin — acesso total ──────────────────────────────────────
  { role: 'admin', resource: 'books', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'autores', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'midias', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'categorias', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'subgeneros', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'permissions', actions: ['create', 'read', 'update', 'delete'] },

  // ── editor — cria e lê entidades de catálogo; lê usuários ────
  { role: 'editor', resource: 'books', actions: ['create', 'read', 'update'] },
  { role: 'editor', resource: 'users', actions: ['read'] },
  { role: 'editor', resource: 'autores', actions: ['create', 'read'] },
  { role: 'editor', resource: 'midias', actions: ['create', 'read'] },
  { role: 'editor', resource: 'categorias', actions: ['create', 'read'] },
  { role: 'editor', resource: 'subgeneros', actions: ['create', 'read'] },
  { role: 'editor', resource: 'permissions', actions: [] },

  // ── viewer — somente leitura ──────────────────────────────────
  { role: 'viewer', resource: 'books', actions: ['read'] },
  { role: 'viewer', resource: 'users', actions: [] },
  { role: 'viewer', resource: 'autores', actions: ['read'] },
  { role: 'viewer', resource: 'midias', actions: ['read'] },
  { role: 'viewer', resource: 'categorias', actions: ['read'] },
  { role: 'viewer', resource: 'subgeneros', actions: ['read'] },
  { role: 'viewer', resource: 'permissions', actions: [] },
] as const
