<script setup lang="ts">
import type { HeadingNode } from "@/utils/blog/heading-outline";
defineProps<{ nodes: HeadingNode[] }>();
defineEmits<{ navigate: [id: string] }>();
</script>
<template>
  <ol class="outline-branch">
    <li v-for="node in nodes" :key="node.id">
      <button @click="$emit('navigate', node.id)">{{ node.text }}</button>
      <OutlineBranch
        v-if="node.children.length"
        :nodes="node.children"
        @navigate="$emit('navigate', $event)"
      />
    </li>
  </ol>
</template>
