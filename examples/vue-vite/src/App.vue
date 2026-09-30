<template>
  <div class="page">
    <nav>
      <button v-for="t in tabs" :key="t" :disabled="tab === t" @click="tab = t">{{ t }}</button>
      <span v-if="opened" class="opened">Opened: {{ opened.note }}<template v-if="opened.quote"> (at “{{ opened.quote }}”)</template></span>
    </nav>
    <div class="stage">
      <!-- :key remounts the graph when the tab changes, so each tab gets a fresh page. -->
      <KnowledgeGraph2D v-if="tab === '2d'" key="2d" :sources="sources" :graphs="graphs" @open="opened = $event" />
      <KnowledgeGraph3D v-else-if="tab === '3d'" key="3d" :sources="sources" :graphs="graphs" @open="opened = $event" />
      <SemanticGraph3D v-else key="semantic" :semantic="semantic" :categories="categories" @open="opened = $event" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createStaticSemantic, type GraphSource, type OpenTarget, type SemanticCategory } from '2d-3d-knowledge-graph'
import { KnowledgeGraph2D, KnowledgeGraph3D, SemanticGraph3D } from '2d-3d-knowledge-graph/vue'

const tabs = ['2d', '3d', 'semantic'] as const
const tab = ref<typeof tabs[number]>('2d')
const opened = ref<OpenTarget | null>(null)
const sources: GraphSource[] = [
  { id: 'links', label: 'Links', settingsKey: 'vue-demo.links', noun: 'notes',
    groups: [{ query: 'path:worlds/', color: '#52b1e0' }, { query: 'path:species/', color: '#52e052' }, { query: 'path:maps/', color: '#ffffff' }] },
  { id: 'graphify', label: 'Graphify', settingsKey: 'vue-demo.graphify', graphify: true, noun: 'nodes', groups: [] },
]
const graphs = { links: '/links.json', graphify: '/graphify.json' }
const semantic = createStaticSemantic('/semantic.json')
const categories: SemanticCategory[] = [{ id: 'folder', label: 'Folder', field: 'folder' }, { id: 'status', label: 'Status', field: 'status' }]
</script>

<style>
.page { display: flex; flex-direction: column; height: 100%; }
nav { display: flex; gap: 8px; padding: 8px; }
.opened { margin-left: auto; }
.stage { flex: 1; min-height: 0; }
</style>
