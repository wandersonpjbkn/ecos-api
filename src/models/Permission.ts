import { Schema, model } from 'mongoose'
import { RESOURCES, ACTIONS, ROLES } from '@/constants/index.js'
import type { Role, Resource, Action } from '@/types/index.ts'

export interface IPermission {
  role: Role
  resource: Resource
  actions: Action[]
}

const PermissionSchema = new Schema<IPermission>(
  {
    role: { type: String, enum: ROLES, required: true },
    resource: { type: String, enum: RESOURCES, required: true },
    actions: [{ type: String, enum: ACTIONS }],
  },
  { timestamps: false },
)

PermissionSchema.index({ role: 1, resource: 1 }, { unique: true })

export const Permission = model<IPermission>('Permission', PermissionSchema)
