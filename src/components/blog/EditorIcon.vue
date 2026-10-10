<script setup lang="ts">
defineProps<{ name: string }>();
</script>
<template>
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      v-if="name === 'bold'"
      d="M6 4h7a4 4 0 0 1 0 8H6m0 0h8a4 4 0 0 1 0 8H6V4"
    />
    <path v-else-if="name === 'italic'" d="M10 4h9M5 20h9M15 4 9 20" />
    <path
      v-else-if="name === 'strike'"
      d="M17 5c-1-1-3-2-5-2-7 0-7 7 0 9m-5 7c1 1 3 2 5 2 7 0 7-7 0-9M3 12h18"
    />
    <path
      v-else-if="name === 'quote'"
      d="M4 5h6v7H4v-7Zm0 7c0 4 2 6 5 7M14 5h6v7h-6v-7Zm0 7c0 4 2 6 5 7"
    />
    <path
      v-else-if="name === 'bullet'"
      d="M4 6h.01M4 12h.01M4 18h.01M9 6h12M9 12h12M9 18h12"
    />
    <path
      v-else-if="name === 'numbered'"
      d="M3 4h1v6M3 10h2M2 15a2 2 0 0 1 4 0c0 2-4 3-4 5h4M10 6h11M10 12h11M10 18h11"
    />
    <path
      v-else-if="name === 'code'"
      d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16"
    />
    <template v-else-if="name === 'table'">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </template>
    <path v-else-if="name === 'math'" d="M19 4H6l7 8-7 8h13M19 4v3m0 10v3" />
    <template v-else-if="name.startsWith('align-')">
      <path d="M3 4h18M3 20h18" />
      <rect
        v-if="name === 'align-left'"
        x="3"
        y="8"
        width="10"
        height="8"
        rx="1"
      />
      <rect
        v-else-if="name === 'align-right'"
        x="11"
        y="8"
        width="10"
        height="8"
        rx="1"
      />
      <rect v-else x="7" y="8" width="10" height="8" rx="1" />
    </template>
    <path v-else-if="name === 'divider'" d="M3 12h18" />
    <path
      v-else-if="name === 'link'"
      d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
      transform="translate(1 1)"
    />
    <template v-else-if="name === 'image'">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </template>
    <path
      v-else-if="name === 'undo'"
      d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"
      transform="translate(0 -1)"
    />
    <path
      v-else-if="name === 'redo'"
      d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14"
      transform="translate(0 -1)"
    />
    <path
      v-else-if="name === 'pen'"
      d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"
    />
    <template v-else-if="name === 'folder'">
      <path
        d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
      />
    </template>
    <path
      v-else-if="name === 'trash'"
      d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"
    />
    <path v-else-if="name === 'tag'" d="M3 3h8l10 10-8 8L3 11V3ZM7 7h.01" />
    <path
      v-else-if="name === 'save'"
      d="M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8"
    />
    <template v-else-if="name === 'split'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </template>
  </svg>
</template>
