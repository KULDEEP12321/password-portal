/**
 * Projects ("rooms") — private containers for secrets, each with its own member
 * list. Stored at `projects/<id>.json`. A project's secrets are visible only to
 * its members (and to admins, who manage all projects).
 */
import { randomUUID } from 'node:crypto'
import { delKey, getJson, listKeys, putJson } from './db'
import { Errors } from './errors'
import type { PublicProject, PublicUser } from '../types'

const PREFIX = 'projects/'

export interface ProjectRecord {
  id: string
  name: string
  description?: string
  memberIds: string[]
  createdAt: string
  createdBy: string
}

function keyFor(id: string): string {
  return `${PREFIX}${id}.json`
}

export function toPublicProject(p: ProjectRecord, secretCount?: number): PublicProject {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    memberIds: p.memberIds,
    createdAt: p.createdAt,
    createdBy: p.createdBy,
    secretCount,
  }
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const keys = await listKeys(PREFIX)
  const loaded = await Promise.all(keys.map((k) => getJson<ProjectRecord>(k.key)))
  return loaded
    .filter((p): p is ProjectRecord => p != null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  return getJson<ProjectRecord>(keyFor(id))
}

/** Whether a user may access a project's secrets (an admin, or a listed member). */
export function userInProject(user: PublicUser, project: ProjectRecord): boolean {
  return user.role === 'admin' || project.memberIds.includes(user.id)
}

/** Every project a user may access (admins see all). */
export async function accessibleProjects(user: PublicUser): Promise<ProjectRecord[]> {
  const all = await listProjects()
  return user.role === 'admin' ? all : all.filter((p) => p.memberIds.includes(user.id))
}

/** Load a project and assert the user may access it, else throw 403/404. */
export async function requireProjectAccess(
  user: PublicUser,
  projectId: string,
): Promise<ProjectRecord> {
  const project = await getProject(projectId)
  if (!project) throw Errors.notFound('Project not found.')
  if (!userInProject(user, project)) {
    throw Errors.forbidden('You do not have access to this project.')
  }
  return project
}

export interface ProjectInput {
  name: string
  description?: string
  memberIds: string[]
}

export async function createProject(
  input: ProjectInput,
  createdBy: string,
): Promise<ProjectRecord> {
  const record: ProjectRecord = {
    id: randomUUID(),
    name: input.name,
    description: input.description || undefined,
    memberIds: [...new Set(input.memberIds)],
    createdAt: new Date().toISOString(),
    createdBy,
  }
  await putJson(keyFor(record.id), record)
  return record
}

export async function updateProject(id: string, input: ProjectInput): Promise<ProjectRecord> {
  const project = await getProject(id)
  if (!project) throw Errors.notFound('Project not found.')
  project.name = input.name
  project.description = input.description || undefined
  project.memberIds = [...new Set(input.memberIds)]
  await putJson(keyFor(id), project)
  return project
}

export async function deleteProjectRecord(id: string): Promise<void> {
  await delKey(keyFor(id))
}

export async function countProjects(): Promise<number> {
  return (await listKeys(PREFIX)).length
}
