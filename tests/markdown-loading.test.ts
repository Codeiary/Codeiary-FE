// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

function download() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

let code: ReturnType<typeof download>;
let math: ReturnType<typeof download>;
let wrapper: VueWrapper | undefined;
const content = '# 먼저 읽는 본문\n\n라이브러리를 기다리지 않는 **내용**입니다.\n\n```java\npublic class Example { String value = "<script>alert(1)</script>"; }\n```\n\n문장 속 $x^2$ 수식입니다.';

beforeEach(() => {
  vi.resetModules();
  code = download();
  math = download();
  vi.doMock("@/utils/blog/code-highlight", async () => {
    await code.promise;
    return vi.importActual("@/utils/blog/code-highlight");
  });
  vi.doMock("@/utils/blog/markdown-math", async () => {
    await math.promise;
    return vi.importActual("@/utils/blog/markdown-math");
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.doUnmock("@/utils/blog/code-highlight");
  vi.doUnmock("@/utils/blog/markdown-math");
});

describe("본문 점진 표시", () => {
  it("코드와 수식 다운로드 전에 본문을 읽고 완료 후 서식을 볼 수 있다.", async () => {
    const { default: MarkdownContent } = await import("@/components/blog/MarkdownContent.vue");
    wrapper = mount(MarkdownContent, { props: { content, authorId: 1 } });
    expect(wrapper.get("h1").text()).toBe("먼저 읽는 본문");
    expect(wrapper.get("strong").text()).toBe("내용");
    expect(wrapper.get("pre").text()).toContain("<script>alert(1)</script>");
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.find(".hljs-keyword").exists()).toBe(false);
    expect(wrapper.find(".katex").exists()).toBe(false);
    expect(wrapper.text()).toContain("$x^2$");
    expect(wrapper.emitted("outline")?.[0]?.[0]).toEqual([
      { id: "post-heading-0", text: "먼저 읽는 본문", level: 1 },
    ]);

    code.resolve();
    await vi.waitFor(() => expect(wrapper!.find(".hljs-keyword").exists()).toBe(true));
    expect(wrapper.find(".katex").exists()).toBe(false);
    math.resolve();
    await vi.waitFor(() => expect(wrapper!.find(".katex").exists()).toBe(true));
    expect(wrapper.get("h1").attributes("id")).toBe("post-heading-0");
    expect(wrapper.find("script").exists()).toBe(false);
  });

  it("서식 라이브러리 다운로드가 실패해도 안전한 본문을 읽을 수 있다.", async () => {
    const { default: MarkdownContent } = await import("@/components/blog/MarkdownContent.vue");
    wrapper = mount(MarkdownContent, { props: { content, authorId: 1 } });
    code.reject(new Error("download failed"));
    math.reject(new Error("download failed"));
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("먼저 읽는 본문");
    expect(wrapper.get("strong").text()).toBe("내용");
    expect(wrapper.get("pre").text()).toContain("<script>alert(1)</script>");
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.text()).toContain("$x^2$");
  });
});
