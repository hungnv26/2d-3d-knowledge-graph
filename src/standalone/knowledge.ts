// Standalone 2D Knowledge Graph: fills #app from window.KnowledgeGraphConfig.
import { mountKnowledge } from '../knowledge/main'
import { appRoot, standaloneConfig, standaloneHost } from './config'

const c = standaloneConfig()
mountKnowledge(appRoot(), standaloneHost(c), {
  sources: c.sources || [],
  sourceKey: 'kg.2d.source',
  initialSource: c.initialSource,
})
