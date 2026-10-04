export const ROLES = ['admin', 'editor', 'viewer'] as const

export const RESOURCES = [
  'books',
  'users',
  'autores',
  'midias',
  'categorias',
  'subgeneros',
  'permissions',
  'claim',
] as const

export const ACTIONS = ['create', 'read', 'update', 'delete'] as const

export const CONFIGURABLE: Record<(typeof RESOURCES)[number], (typeof ACTIONS)[number][]> = {
  books: ['create', 'update', 'delete'],
  users: ['read'],
  autores: ['create', 'read', 'update', 'delete'],
  midias: ['create', 'read', 'update', 'delete'],
  categorias: ['create', 'read', 'update', 'delete'],
  subgeneros: ['create', 'read', 'update', 'delete'],
  permissions: [],
  claim: ['create', 'update'],
}

export const DEFAULT_PERMISSIONS = [
  // ── admin ──────────────────────────────────────
  { role: 'admin', resource: 'books', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'autores', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'midias', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'categorias', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'subgeneros', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'permissions', actions: ['create', 'read', 'update', 'delete'] },
  { role: 'admin', resource: 'claim', actions: ['create', 'update'] },

  // ── editor ──────────────────────────────────
  { role: 'editor', resource: 'books', actions: ['create', 'read', 'update'] },
  { role: 'editor', resource: 'users', actions: ['read'] },
  { role: 'editor', resource: 'autores', actions: ['create', 'read'] },
  { role: 'editor', resource: 'midias', actions: ['create', 'read'] },
  { role: 'editor', resource: 'categorias', actions: ['create', 'read'] },
  { role: 'editor', resource: 'subgeneros', actions: ['create', 'read'] },
  { role: 'editor', resource: 'permissions', actions: [] },
  { role: 'editor', resource: 'claim', actions: ['update'] },

  // ── viewer ──────────────────────────────────
  { role: 'viewer', resource: 'books', actions: ['read'] },
  { role: 'viewer', resource: 'users', actions: [] },
  { role: 'viewer', resource: 'autores', actions: ['read'] },
  { role: 'viewer', resource: 'midias', actions: ['read'] },
  { role: 'viewer', resource: 'categorias', actions: ['read'] },
  { role: 'viewer', resource: 'subgeneros', actions: ['read'] },
  { role: 'viewer', resource: 'permissions', actions: [] },
  { role: 'viewer', resource: 'claim', actions: [] },
] as const
