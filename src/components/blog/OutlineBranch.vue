<script setup lang="ts">
import type { HeadingNode } from "@/utils/blog/heading-outline";
defineProps<{ nodes: HeadingNode[]; activeId?: string }>();
defineEmits<{ navigate: [id: string] }>();
</script>
<template>
  <ol class="outline-branch">
    <li v-for="node in nodes" :key="node.id">
      <button
        :aria-current="node.id === activeId ? 'location' : undefined"
        @click="$emit('navigate', node.id)"
      >
        {{ node.text }}
      </button>
      <OutlineBranch
        v-if="node.children.length"
        :nodes="node.children"
        :active-id="activeId"
        @navigate="$emit('navigate', $event)"
      />
    </li>
  </ol>
</template>
