// Standalone 3D Semantic Graph: fills #app from window.KnowledgeGraphConfig.
import { mountSemantic } from '../semantic/main'
import { appRoot, standaloneConfig, standaloneHost } from './config'

const c = standaloneConfig()
const s = c.semantic || {}
mountSemantic(appRoot(), standaloneHost(c), {
  settingsKey: 'kg.semantic.settings',
  categories: s.categories || [],
  scopes: s.scopes?.map(({ id, label }) => ({ id, label })),
  defaultScope: s.defaultScope,
  allowBuild: false,
  buildIntro: s.buildIntro || 'Build the layout with tools/semantic, then reload.',
  buildHint: s.buildHint || 'Build the layout with tools/semantic, then reload.',
})
