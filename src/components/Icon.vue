<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'run'">
      <circle cx="15.5" cy="4" r="2" />
      <path d="m8 9 4-2 4 5h4M12 7l-2 7 5 3-1 5M10 14l-4 5H2" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </template>
    <template v-else-if="name === 'menu'">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </template>
    <template v-else-if="name === 'home'">
      <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />
    </template>
    <template v-else-if="name === 'mail'">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3 7 9 6 9-6" />
    </template>
    <template v-else-if="name === 'lock'">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </template>
    <template v-else-if="name === 'eye' || name === 'eye-off'">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path v-if="name === 'eye-off'" d="m3 3 18 18" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'arrow-left'">
      <path d="M20 12H4m6-6-6 6 6 6" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9 4H4v16h5m0-8h12m-4-4 4 4-4 4" />
    </template>
    <template v-else-if="name === 'arrow'">
      <path d="M5 19 19 5M5 5h14v14" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
      <path d="M12 5v15M6 8h3M6 11h3M15 8h3M15 11h3" />
    </template>
    <template v-else-if="name === 'case'">
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M8 7V4h8v3M3 12c5 3 13 3 18 0M10 13h4v3h-4z" />
    </template>
    <template v-else-if="name === 'news'">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 7h10M7 11h4v6H7zM15 11h2M15 14h2M15 17h2" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"
      />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />
    </template>
    <template v-else-if="name === 'sound'">
      <path
        d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"
      />
    </template>
    <template v-else-if="name === 'mute'">
      <path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l5 6M21 9l-5 6" />
    </template>
    <template v-else-if="name === 'compass'">
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2 6-6 2 2-6 6-2Z" />
    </template>
    <template v-else-if="name === 'pin'">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m9 5 7 7-7 7" />
    </template>
    <template v-else-if="name === 'reset'">
      <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" />
    </template>
    <template v-else-if="name === 'help'">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M12 17h.01" />
    </template>
    <template v-else-if="name === 'walk'">
      <circle cx="14" cy="4" r="2" />
      <path d="m8 22 3-7-1-5 4-3 3 5h4M3 12l4-1 3-4M11 15l5 3v4" />
    </template>
    <template v-else-if="name === 'map'">
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16" />
    </template>
    <template v-else-if="name === 'asterisk'">
      <path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5" />
    </template>
    <template v-else-if="name === 'spark'">
      <path
        d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"
      />
    </template>
    <template v-else-if="name === 'github'">
      <path
        d="M9 19c-4 1-4-2-6-2M15 22v-4c0-1-.2-2-1-2 4-.5 6-2 6-6 0-1-1-2-1-3 0-1 0-2-.5-3-2 0-3 1-3 1a12 12 0 0 0-7 0s-1-1-3-1c-.5 1-.5 2-.5 3-1 1-1 2-1 3 0 4 2 5.5 6 6-1 0-1 1-1 2v4"
      />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </template>
  </svg>
</template>
