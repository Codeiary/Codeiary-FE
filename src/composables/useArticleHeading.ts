import { nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { ArticleHeading } from "@/utils/blog/heading-outline";

export function useArticleHeading(
  root: Ref<HTMLElement | undefined>,
  headings: Ref<ArticleHeading[]>,
) {
  const activeId = ref("");
  const stop = watch(
    [root, headings],
    async ([element, entries], _, cleanup) => {
      let cancelled = false;
      let frame = 0;
      let observer: ResizeObserver | undefined;
      let scroller: HTMLElement | null = null;
      function update() {
        frame = 0;
        if (!element || !entries.length || cancelled) return;
        const top = scroller?.getBoundingClientRect().top ?? 0;
        const threshold = top + 64;
        const nodes = Array.from(
          element.querySelectorAll<HTMLElement>(".markdown-content [id]"),
        );
        const positions = new Map(
          nodes.map((node) => [node.id, node.getBoundingClientRect().top]),
        );
        let current = entries[0]!.id;
        for (const entry of entries) {
          const y = positions.get(entry.id);
          if (y !== undefined && y <= threshold) current = entry.id;
        }
        if (
          scroller &&
          scroller.scrollHeight > scroller.clientHeight + 2 &&
          scroller.scrollTop + scroller.clientHeight >=
            scroller.scrollHeight - 2
        )
          current = entries[entries.length - 1]!.id;
        activeId.value = current;
      }
      function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
      }
      cleanup(() => {
        cancelled = true;
        cancelAnimationFrame(frame);
        scroller?.removeEventListener("scroll", schedule);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        observer?.disconnect();
      });
      activeId.value = entries[0]?.id ?? "";
      await nextTick();
      if (!element || cancelled) return;
      scroller = element.closest<HTMLElement>(
        ".article-body, .writer-preview-scroll",
      );
      (scroller ?? window).addEventListener("scroll", schedule, {
        passive: true,
      });
      window.addEventListener("resize", schedule, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(schedule);
        observer.observe(element);
      }
      update();
    },
    { flush: "post", immediate: true },
  );
  onBeforeUnmount(stop);
  return activeId;
}
