import { Schema, model } from 'mongoose'
import type { Role, Resource, Action } from '@/types/index.ts'

export interface IPermission {
  role: Role
  resource: Resource
  actions: Action[]
}

const PermissionSchema = new Schema<IPermission>(
  {
    role:     { type: String, enum: ['admin', 'editor', 'viewer'], required: true },
    resource: { type: String, enum: ['books', 'users', 'subgeneros', 'permissions'], required: true },
    actions:  [{ type: String, enum: ['create', 'read', 'update', 'delete'] }],
  },
  { timestamps: false },
)

// Garante que cada combinação role+resource é única
PermissionSchema.index({ role: 1, resource: 1 }, { unique: true })

export const Permission = model<IPermission>('Permission', PermissionSchema)
