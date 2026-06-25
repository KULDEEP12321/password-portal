/**
 * Project ("room") server functions. Listing returns only the projects the
 * caller can access (admins see all). Creating / editing / deleting projects and
 * managing their members is admin-only.
 */
import { createServerFn } from '@tanstack/react-start'
import { getActorContext, requireUser } from '../server/session'
import {
  accessibleProjects,
  createProject,
  deleteProjectRecord,
  getProject,
  toPublicProject,
  updateProject,
} from '../server/projects'
import { countSecretsByProject, deleteSecretsInProject } from '../server/secrets'
import { writeAudit } from '../server/audit'
import { Errors } from '../server/errors'
import { createProjectSchema, idSchema, updateProjectSchema } from '../server/schemas'
import type { PublicProject } from '../types'

export const listProjectsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PublicProject[]> => {
    const user = await requireUser()
    const [projects, counts] = await Promise.all([
      accessibleProjects(user),
      countSecretsByProject(),
    ])
    return projects.map((p) => toPublicProject(p, counts[p.id] ?? 0))
  },
)

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => createProjectSchema.parse(d))
  .handler(async ({ data }): Promise<PublicProject> => {
    const admin = await requireUser(['admin'])
    const { ip, userAgent } = getActorContext()
    const project = await createProject(data, admin.username)
    await writeAudit({
      actor: admin.username,
      actorId: admin.id,
      action: 'project.create',
      targetId: project.id,
      targetName: project.name,
      ip,
      userAgent,
      detail: `${project.memberIds.length} member(s)`,
    })
    return toPublicProject(project, 0)
  })

export const updateProjectFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => updateProjectSchema.parse(d))
  .handler(async ({ data }): Promise<PublicProject> => {
    const admin = await requireUser(['admin'])
    const { ip, userAgent } = getActorContext()
    const { id, ...input } = data
    const project = await updateProject(id, input)
    await writeAudit({
      actor: admin.username,
      actorId: admin.id,
      action: 'project.update',
      targetId: project.id,
      targetName: project.name,
      ip,
      userAgent,
      detail: `${project.memberIds.length} member(s)`,
    })
    return toPublicProject(project)
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; deletedSecrets: number }> => {
    const admin = await requireUser(['admin'])
    const { ip, userAgent } = getActorContext()
    const project = await getProject(data.id)
    if (!project) throw Errors.notFound('Project not found.')
    // Cascade: removing a project removes its secrets.
    const deletedSecrets = await deleteSecretsInProject(project.id)
    await deleteProjectRecord(project.id)
    await writeAudit({
      actor: admin.username,
      actorId: admin.id,
      action: 'project.delete',
      targetId: project.id,
      targetName: project.name,
      ip,
      userAgent,
      detail: `Deleted ${deletedSecrets} secret(s)`,
    })
    return { ok: true, deletedSecrets }
  })
