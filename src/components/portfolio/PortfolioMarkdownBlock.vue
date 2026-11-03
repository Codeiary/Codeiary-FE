<script setup lang="ts">
import { computed } from "vue";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { normalizePortfolioDocument } from "@/utils/portfolio/document";
import PortfolioRichContent from "./PortfolioRichContent.vue";
const props = defineProps<{ content: string }>();
const parser = new MarkdownManager({ extensions: [StarterKit, Image, TableKit] });
const document = computed(() => normalizePortfolioDocument(parser.parse(props.content)));
</script>
<template><PortfolioRichContent :document="document" /></template>
