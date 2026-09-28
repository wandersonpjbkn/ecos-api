import { Types } from 'mongoose'

import { Book } from '@/models/Book.js'
import { Permission } from '@/models/Permission.js'
import { User } from '@/models/User.js'
import { slugify } from '@/utils/global.js'

// Lowercase inside a name, never at its start: "Maria de Souza".
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** A person's name as the club writes it: each word capitalised, the rest lowercase; "Natália C." for two Natálias. */
export const formatName = (raw: string): string =>
  raw
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLocaleLowerCase('pt-BR')
      if (i > 0 && PARTICLES.has(lower)) return lower
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
    })
    .join(' ')

/** The same slug rule as authors and genres: "Natalia" and "natália" are one name, "Natalia C." another. */
export const sameName = (a: string, b: string): boolean => slugify(a) === slugify(b)

export class PersonError extends Error {
  constructor(
    readonly status: 400 | 403 | 409,
    message: string,
  ) {
    super(message)
  }
}

const may = async (role: string, resource: string, action: string): Promise<boolean> =>
  !!(await Permission.exists({ role, resource, actions: action }))

/** Placeholders from the first load, each with the account that claimed it (null while nobody has). */
const placeholders = async (): Promise<{ name: string; userId: Types.ObjectId | null }[]> => {
  const rows = await Book.aggregate<{ _id: string; userId: Types.ObjectId | null }>([
    { $match: { quem_nome: { $type: 'string', $ne: '' } } },
    { $group: { _id: '$quem_nome', userId: { $max: '$quem_user_id' } } },
  ])
  return rows.map((row) => ({ name: row._id, userId: row.userId ?? null }))
}

/** Who a book can be credited to: every account, plus the placeholders nobody has claimed. */
export const creditablePeople = async (): Promise<{ user_id: string | null; name: string }[]> => {
  const [users, marks] = await Promise.all([User.find().select('name').lean(), placeholders()])
  const people = [
    ...users.map((u) => ({ user_id: String(u._id), name: u.name })),
    ...marks.filter((m) => !m.userId).map((m) => ({ user_id: null, name: m.name })),
  ]
  return people.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** An unclaimed placeholder with this account's name: the add form asks "is this you?" before going on. */
export const claimMatch = async (user: { _id: Types.ObjectId; name: string; role: string }): Promise<string | null> => {
  if (!(await may(user.role, 'claim', 'update'))) return null
  if (await Book.exists({ quem_user_id: user._id, quem_nome: { $type: 'string', $ne: '' } })) return null
  const free = (await placeholders()).filter((m) => !m.userId)
  return free.find((m) => sameName(m.name, user.name))?.name ?? null
}

interface Actor {
  _id: Types.ObjectId
  role: string
}

/** Who mentioned the book (account or placeholder); a new book defaults to its adder, a new name needs claim: create. */
export const applyBookPerson = async (
  payload: Record<string, unknown>,
  actor: Actor,
  current?: { quem_nome?: string | null; quem_user_id?: Types.ObjectId | null },
): Promise<void> => {
  const userId = typeof payload.quem_user_id === 'string' && payload.quem_user_id ? payload.quem_user_id : null
  const typed = typeof payload.quem_nome === 'string' ? payload.quem_nome.trim() : ''
  delete payload.quem_user_id
  delete payload.quem_nome

  if (!userId && !typed) {
    if (current) return
    payload.quem_user_id = actor._id
    return
  }

  if (userId) {
    if (current && String(current.quem_user_id ?? '') === userId && !current.quem_nome) return
    if (!Types.ObjectId.isValid(userId) || !(await User.exists({ _id: userId }))) {
      throw new PersonError(400, 'Escolha alguém da lista.')
    }
    // Credited to the account itself; the claimed placeholder, if any, keeps its own books.
    payload.quem_user_id = new Types.ObjectId(userId)
    payload.quem_nome = null
    return
  }

  if (current && current.quem_nome === typed) return
  const marks = await placeholders()
  const existing = marks.find((m) => sameName(m.name, typed))
  if (existing) {
    if (existing.name !== formatName(typed) && existing.name !== typed) {
      throw new PersonError(409, `Já existe "${existing.name}". Escolha na lista ou diferencie com um sobrenome ou inicial.`)
    }
    payload.quem_nome = existing.name
    payload.quem_user_id = existing.userId
    return
  }

  if (!(await may(actor.role, 'claim', 'create'))) {
    throw new PersonError(403, 'Incluir um nome novo não está liberado para a sua conta. Escolha alguém da lista.')
  }
  const users = await User.find().select('name').lean()
  const taken = users.find((u) => sameName(u.name, typed))
  if (taken) {
    throw new PersonError(409, `Já existe "${taken.name}". Escolha na lista ou diferencie com um sobrenome ou inicial.`)
  }
  payload.quem_nome = formatName(typed)
  payload.quem_user_id = null
}
