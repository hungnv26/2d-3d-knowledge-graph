// Standalone 3D Knowledge Graph: fills #app from window.KnowledgeGraphConfig.
import { mount3D } from '../force3d/main'
import { appRoot, standaloneConfig, standaloneHost } from './config'

const c = standaloneConfig()
mount3D(appRoot(), standaloneHost(c), { sources: c.sources || [], settingsKey: 'kg.3d.settings' })
