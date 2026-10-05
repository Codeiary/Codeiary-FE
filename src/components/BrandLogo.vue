<script setup lang="ts">
import { useId } from "vue";

const coverId = `diary-cover-${useId()}`;
</script>

<template>
  <svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient
        :id="coverId"
        x1="7"
        y1="7"
        x2="33"
        y2="31"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#e8dfca" />
        <stop offset="0.16" stop-color="#fcf7e8" />
        <stop offset="0.82" stop-color="#fbf5e6" />
        <stop offset="1" stop-color="#f2e8d4" />
      </linearGradient>
    </defs>
    <g transform="rotate(-11 20 20)">
      <rect
        x="7.5"
        y="5"
        width="27"
        height="32.5"
        rx="3"
        fill="#655136"
        opacity=".09"
      />
      <rect
        x="7.5"
        y="4"
        width="26"
        height="32"
        rx="2.5"
        fill="#faf5e9"
        stroke="#d4c8b1"
        stroke-width=".8"
      />
      <path d="M10 33.5h20.5M10 34.8h20" stroke="#e0d4bd" stroke-width=".6" />
      <rect
        x="6"
        y="2.5"
        width="26"
        height="31"
        rx="2.5"
        :fill="`url(#${coverId})`"
        stroke="#e3d8c0"
        stroke-width=".8"
      />
      <path
        d="M9.5 3v30"
        stroke="#cabd9f"
        stroke-opacity=".65"
        stroke-width=".7"
      />
      <path
        d="M10.5 3v30"
        stroke="#fffefb"
        stroke-opacity=".8"
        stroke-width=".6"
      />
      <path d="M24 2.5h4.5v8.5l-2.25-1.8L24 11V2.5Z" fill="#db855f" />
      <text
        x="19.5"
        y="26.8"
        text-anchor="middle"
        fill="#666862"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="23"
        font-style="italic"
        font-weight="400"
      >
        d
      </text>
      <circle cx="26.1" cy="25.5" r="1.3" fill="#d18460" />
      <path d="M13 29.5h14" stroke="#d3c9b4" stroke-width=".6" />
    </g>
  </svg>
  <span class="brand-wordmark"
    >codeiary<span class="brand-period">.</span></span
  >
</template>
