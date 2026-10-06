// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB, openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addImage,
  createDraft,
  editPost,
  listDrafts,
  readDraft,
  resolveImages,
  resolveImageSizes,
  saveImageSize,
  saveDraft,
} from "@/services/blog-storage";
import { loadLocalPosts, localPosts, publishDraft } from "@/store/blog";
import { markdownHeadings, renderMarkdown } from "@/utils/blog/markdown";
import { buildHeadingTree } from "@/utils/blog/heading-outline";
import { markdownInsertion } from "@/utils/blog/editor-commands";
import { userFixture } from "./fixtures/auth";

function draftFixture() {
  return {
    ...createDraft(userFixture("USER")),
    title: "배움의 기록",
    category: "백엔드",
    content: "## 오늘 배운 것\n\n**트랜잭션**을 이해합니다.",
    tags: ["Spring", "Java"],
  };
}
beforeEach(async () => {
  await deleteDB("codeiary.blog.mock.v1");
  localPosts.value = [];
});

describe("글쓰기 목데이터 저장", () => {
  it("초안의 본문과 카테고리와 태그를 다시 불러올 수 있다.", async () => {
    const draft = draftFixture();
    await saveDraft(draft);
    expect(await readDraft(draft.id, draft.authorId)).toEqual(draft);
    expect(await listDrafts(draft.authorId)).toEqual([draft]);
  });
  it("다른 계정의 작성 내용을 숨길 수 있다.", async () => {
    const draft = draftFixture();
    await saveDraft(draft);
    expect(await readDraft(draft.id, 99)).toBeUndefined();
    expect(await listDrafts(99)).toEqual([]);
    expect(await readDraft(draft.id, draft.authorId)).toEqual(draft);
  });
  it("게시한 글을 복원하고 사용한 초안을 정리할 수 있다.", async () => {
    const draft = draftFixture();
    await saveDraft(draft);
    const post = await publishDraft(draft);
    localPosts.value = [];
    await loadLocalPosts();
    expect(localPosts.value).toEqual([post]);
    expect(post).toMatchObject({
      title: draft.title,
      content: draft.content,
      category: "백엔드",
      tags: draft.tags,
      status: "PUBLISHED",
    });
    expect(await listDrafts(draft.authorId)).toEqual([]);
  });
  it("같은 제목의 글을 구분하고 수정할 때 기존 주소를 유지할 수 있다.", async () => {
    const first = draftFixture();
    const second = draftFixture();
    await saveDraft(first);
    await saveDraft(second);
    const original = await publishDraft(first);
    const duplicate = await publishDraft(second);
    expect(original.slug).toBe("배움의-기록");
    expect(duplicate.slug).toBe("배움의-기록-2");
    const edit = await editPost(original, first.authorId);
    edit.title = "새로운 제목";
    await saveDraft(edit);
    const updated = await publishDraft(edit);
    expect(updated.id).toBe(original.id);
    expect(updated.slug).toBe(original.slug);
    expect(updated.title).toBe("새로운 제목");
  });
  it("게시하지 못해도 저장한 초안을 유지할 수 있다.", async () => {
    const draft = { ...draftFixture(), title: "" };
    await saveDraft(draft);
    await expect(publishDraft(draft)).rejects.toThrow("제목과 본문");
    expect(await readDraft(draft.id, draft.authorId)).toEqual(draft);
  });
  it("직접 입력한 카테고리를 저장하고 빈 카테고리를 거절할 수 있다.", async () => {
    const draft = { ...draftFixture(), category: "   " };
    await saveDraft(draft);
    await expect(publishDraft(draft)).rejects.toThrow("카테고리");
    draft.category = "  나만의 개발 이야기  ";
    await saveDraft(draft);
    expect((await publishDraft(draft)).category).toBe("나만의 개발 이야기");
  });
  it("비공개 글과 이미지 배치를 복원하고 공개로 전환할 수 있다.", async () => {
    const draft = draftFixture();
    const key = JSON.stringify(["https://example.com/image.png", 0]);
    draft.visibility = "PRIVATE";
    draft.imageLayouts = { [key]: { width: 50, align: "right" } };
    await saveDraft(draft);
    const post = await publishDraft(draft);
    expect(post.visibility).toBe("PRIVATE");
    const edit = await editPost(post, draft.authorId);
    expect(edit.visibility).toBe("PRIVATE");
    expect(edit.imageLayouts).toEqual(draft.imageLayouts);
    edit.visibility = "PUBLIC";
    await saveDraft(edit);
    expect((await publishDraft(edit)).visibility).toBe("PUBLIC");
  });
  it("첨부 이미지를 저장하고 게시 후에도 표시할 수 있다.", async () => {
    const draft = draftFixture();
    await saveDraft(draft);
    const src = await addImage(
      new File([new Uint8Array([137, 80, 78, 71])], "diagram.png", {
        type: "image/png",
      }),
      draft,
    );
    draft.content += `\n\n![구조도](${src})`;
    await saveDraft(draft);
    const post = await publishDraft(draft);
    const images = await resolveImages(post.content!, draft.authorId);
    expect(images[src]).toMatch(/^data:image\/png;base64,/);
    const html = document.createElement("div");
    html.innerHTML = renderMarkdown(post.content!, images);
    expect(html.querySelector("img")?.getAttribute("src")).toBe(images[src]);
    expect(await resolveImages(post.content!, 99)).toEqual({ [src]: "" });
  });
  it("대표 이미지를 본문과 별개로 저장하고 수정할 수 있다.", async () => {
    const draft = draftFixture();
    draft.coverImage = await addImage(
      new File(["cover"], "cover.png", { type: "image/png" }),
      draft,
    );
    await saveDraft(draft);
    const restored = await readDraft(draft.id, draft.authorId);
    expect(restored?.coverImage).toBe(draft.coverImage);
    const post = await publishDraft(restored!);
    localPosts.value = [];
    await loadLocalPosts();
    expect(localPosts.value[0]?.coverImage).toBe(draft.coverImage);
    expect(post.content).toBe(draft.content);
    expect(
      (await resolveImages(post.coverImage!, draft.authorId))[post.coverImage!],
    ).toMatch(/^data:image\/png;base64,/);

    const edit = await editPost(post, draft.authorId);
    expect(edit.coverImage).toBe(draft.coverImage);
    edit.coverImage = await addImage(
      new File(["replacement"], "replacement.png", { type: "image/png" }),
      edit,
    );
    await saveDraft(edit);
    const updated = await publishDraft(edit);
    expect(updated.coverImage).toBe(edit.coverImage);
    expect(updated.coverImage).not.toBe(post.coverImage);
    expect(updated.content).toBe(draft.content);
  });
  it("대표 이미지를 삭제해도 본문에서 쓰는 이미지를 유지할 수 있다.", async () => {
    const draft = draftFixture();
    const src = await addImage(
      new File(["shared"], "shared.png", { type: "image/png" }),
      draft,
    );
    draft.coverImage = src;
    draft.content += `\n\n![본문 이미지](${src})`;
    await saveDraft(draft);
    const post = await publishDraft(draft);
    const edit = await editPost(post, draft.authorId);
    edit.coverImage = undefined;
    await saveDraft(edit);
    const updated = await publishDraft(edit);
    expect(updated.coverImage).toBeUndefined();
    expect(updated.content).toBe(draft.content);
    expect(
      (await resolveImages(updated.content!, draft.authorId))[src],
    ).toMatch(/^data:image\/png;base64,/);
  });
  it("지원하지 않는 파일과 너무 큰 이미지를 거절할 수 있다.", async () => {
    const draft = draftFixture();
    await expect(
      addImage(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }), draft),
    ).rejects.toThrow("PNG");
    await expect(
      addImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", {
          type: "image/png",
        }),
        draft,
      ),
    ).rejects.toThrow("5MB");
  });
});

describe("마크다운 표시", () => {
  it("새 이미지의 원본 크기를 유지하고 지정한 너비를 다시 원본으로 되돌릴 수 있다.", () => {
    const src = "https://example.com/small.png";
    const key = JSON.stringify([src, 0]);
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(`![이미지](${src})`);
    expect(element.querySelector("img")?.style.width).toBe("auto");
    element.innerHTML = renderMarkdown(
      `![이미지](${src})`,
      {},
      { imageLayouts: { [key]: { width: 50, align: "right" } } },
    );
    expect(element.querySelector("img")?.style.width).toBe("50%");
    element.innerHTML = renderMarkdown(
      `![이미지](${src})`,
      {},
      {
        imageLayouts: { [key]: { width: 50, align: "right", original: true } },
      },
    );
    expect(element.querySelector("img")?.style.width).toBe("auto");
    expect(element.querySelector("img")?.style.marginRight).toBe("0px");
  });
  it("같은 줄의 이미지를 묶고 줄바꿈한 이미지는 따로 배치할 수 있다.", () => {
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(
      "![하나](https://example.com/1.png) ![둘](https://example.com/2.png) ![셋](https://example.com/3.png)\n\n![넷](https://example.com/4.png)\n![다섯](https://example.com/5.png)",
    );
    expect(element.querySelectorAll(".markdown-image-row")).toHaveLength(1);
    expect(element.querySelectorAll(".markdown-image-row > img")).toHaveLength(
      3,
    );
    expect(element.querySelectorAll("img")).toHaveLength(5);
    expect(
      Number(
        element
          .querySelector(".markdown-image-row img")
          ?.getAttribute("data-image-width"),
      ),
    ).toBeCloseTo(100 / 3);
  });
  it("이미지가 아직 로딩 중이어도 행과 다음 문단을 구분할 수 있다.", () => {
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(
      "![하나](attachment:first) ![둘](attachment:second)\n\n다음 문단",
    );
    expect(
      element.querySelectorAll(".markdown-image-row .markdown-image-missing"),
    ).toHaveLength(2);
    expect(
      element.querySelector(".markdown-image-row")?.textContent,
    ).not.toContain("다음 문단");
    expect(element.lastElementChild?.textContent).toBe("다음 문단");
  });
  it.each([
    ["java", 'public class Hello { String text = "hello"; }'],
    ["javascript", 'const text = "hello";'],
    ["js", 'const text = "hello";'],
    ["typescript", 'const text: string = "hello";'],
    ["python", 'def hello():\n    return "hello"'],
  ])(
    "%s 코드의 키워드와 문자열에 색상을 지정할 수 있다.",
    (language, source) => {
      const element = document.createElement("div");
      element.innerHTML = renderMarkdown(
        "```" + language + "\n" + source + "\n```",
      );
      expect(element.querySelector("pre code .hljs-keyword")).not.toBeNull();
      expect(element.querySelector("pre code .hljs-string")).not.toBeNull();
      expect(element.querySelector("pre code")?.textContent).toBe(
        source + "\n",
      );
    },
  );
  it.each(["html", "unknown-language", ""])(
    "%s 코드의 HTML을 실행하지 않고 원문으로 표시할 수 있다.",
    (language) => {
      const element = document.createElement("div");
      const source = "<script>alert(1)</script>\n<img src=x onerror=alert(1)>";
      element.innerHTML = renderMarkdown(
        "```" + language + "\n" + source + "\n```",
      );
      expect(element.querySelector("script, img, [onerror]")).toBeNull();
      expect(element.querySelector("pre code")?.textContent).toBe(
        source + "\n",
      );
    },
  );
  it("언어를 선택하고 백틱이 있는 코드도 온전히 삽입할 수 있다.", () => {
    const source = 'String fence = "```";';
    const insertion = markdownInsertion("code", source, "java");
    expect(insertion.text).toMatch(/^````java\n/);
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(insertion.text);
    expect(element.querySelector("code.language-java")?.textContent).toBe(
      source + "\n",
    );
  });
  it("수식과 기울임을 문장 안에서 이어서 표시할 수 있다.", () => {
    const element = document.createElement("div");
    const formula = markdownInsertion("math", "E = mc^2").text;
    element.innerHTML = renderMarkdown(
      `질량과 에너지는 ${formula}로 표현합니다. *기울인 한글*`,
    );
    expect(element.querySelectorAll("p")).toHaveLength(1);
    expect(element.querySelector("p .katex")).not.toBeNull();
    expect(element.querySelector(".katex-display")).toBeNull();
    expect(element.querySelector("em")?.textContent).toBe("기울인 한글");
  });
  it("같은 이미지를 여러 번 넣어도 각각의 크기와 정렬을 유지할 수 있다.", () => {
    const src = "https://example.com/image.png";
    const first = JSON.stringify([src, 0]);
    const second = JSON.stringify([src, 1]);
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(
      `![하나](${src})\n\n![둘](${src})`,
      {},
      {
        imageLayouts: {
          [first]: { width: 50, align: "left" },
          [second]: { width: 25, align: "right" },
        },
        editableImages: true,
        selectedImage: second,
      },
    );
    const images = element.querySelectorAll("img");
    expect(images[0]?.style.width).toBe("50%");
    expect(images[0]?.style.marginLeft).toBe("0px");
    expect(images[1]?.style.width).toBe("25%");
    expect(images[1]?.style.marginRight).toBe("0px");
    expect(images[1]?.getAttribute("data-image-key")).toBe(second);
    expect(images[1]?.getAttribute("aria-pressed")).toBe("true");
  });
  it("제목과 표와 링크와 수식을 읽기 좋게 표시할 수 있다.", () => {
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(
      "# 제목\n\n**강조**\n\n| 항목 | 내용 |\n| --- | --- |\n| 하나 | 둘 |\n\n[문서](https://vuejs.org)\n\n$$\nE = mc^2\n$$",
    );
    expect(element.querySelector("h1")?.textContent).toBe("제목");
    expect(element.querySelector("strong")?.textContent).toBe("강조");
    expect(element.querySelectorAll("td")).toHaveLength(2);
    expect(element.querySelector("a")?.rel).toContain("noopener");
    expect(element.querySelector(".katex")).not.toBeNull();
  });
  it("본문과 수식에 입력된 실행 코드를 차단할 수 있다.", () => {
    const element = document.createElement("div");
    element.innerHTML = renderMarkdown(
      "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[위험](javascript:alert(1))\n\n$\\href{javascript:alert(1)}{링크}$",
    );
    expect(
      element.querySelector(
        "script, [onerror], [onclick], a[href^='javascript:']",
      ),
    ).toBeNull();
  });
  it("선택한 문장을 서식으로 감싸고 표와 수식 문법을 넣을 수 있다.", () => {
    expect(markdownInsertion("bold", "문장")).toEqual({
      text: "**문장**",
      offset: 2,
      length: 2,
    });
    expect(markdownInsertion("h2", "제목").text).toBe("## 제목");
    expect(renderMarkdown(markdownInsertion("table", "").text)).toContain(
      "<table>",
    );
    expect(renderMarkdown(markdownInsertion("math", "").text)).toContain(
      'class="katex"',
    );
  });
});

describe("본문 탐색과 이미지 지연 로딩", () => {
  it("같은 이름의 소제목과 생략된 계층을 구분해 본문으로 이동할 수 있다.", () => {
    const content =
      "# 시작\n\n### **작은 실험**\n\n## 작은 실험\n\n```md\n# 코드 속 제목\n```\n\n# 다음 기록";
    const headings = markdownHeadings(content);
    const document = new DOMParser().parseFromString(
      renderMarkdown(content),
      "text/html",
    );
    expect(headings.map((heading) => [heading.text, heading.level])).toEqual([
      ["시작", 1],
      ["작은 실험", 3],
      ["작은 실험", 2],
      ["다음 기록", 1],
    ]);
    for (const heading of headings)
      expect(document.getElementById(heading.id)?.textContent).toBe(
        heading.text,
      );
    const tree = buildHeadingTree(headings);
    expect(tree.map((node) => node.text)).toEqual(["시작", "다음 기록"]);
    expect(tree[0]?.children.map((node) => node.level)).toEqual([3, 2]);
  });

  it("이미지를 읽기 전에 표시 공간을 확보하고 지연 로딩할 수 있다.", () => {
    const src = "attachment:11111111-1111-1111-1111-111111111111";
    const html = renderMarkdown(
      `![기록](${src})`,
      {},
      {
        deferAttachments: true,
        imageSizes: { [src]: { width: 1200, height: 800 } },
      },
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const image = document.querySelector("img")!;
    expect(image.getAttribute("data-attachment-src")).toBe(src);
    expect(image.getAttribute("src")).toMatch(/^data:image\/gif/);
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(image.getAttribute("width")).toBe("1200");
    expect(image.getAttribute("height")).toBe("800");
    expect(image.style.getPropertyValue("--image-placeholder-ratio")).toBe(
      "1200 / 800",
    );
  });

  it("이전 브라우저 저장소의 글과 이미지를 유지하면서 이미지 크기를 저장할 수 있다.", async () => {
    const draft = draftFixture();
    const id = "11111111-1111-1111-1111-111111111111";
    const src = `attachment:${id}`;
    const db = await openDB("codeiary.blog.mock.v1", 1, {
      upgrade(db) {
        db.createObjectStore("drafts", { keyPath: "id" }).createIndex(
          "authorId",
          "authorId",
        );
        db.createObjectStore("posts", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("images", { keyPath: "id" }).createIndex(
          "draftId",
          "draftId",
        );
      },
    });
    await db.put("drafts", draft);
    await db.put("images", {
      id,
      authorId: draft.authorId,
      draftId: draft.id,
      dataUrl: "data:image/png;base64,fixture",
    });
    db.close();
    expect(await readDraft(draft.id, draft.authorId)).toEqual(draft);
    expect((await resolveImages(src, draft.authorId))[src]).toBe(
      "data:image/png;base64,fixture",
    );
    await saveImageSize(src, draft.authorId, { width: 1200, height: 800 });
    expect(await resolveImageSizes(src, draft.authorId)).toEqual({
      [src]: { width: 1200, height: 800 },
    });
    await saveImageSize(src, 99, { width: 1, height: 1 });
    expect(await resolveImageSizes(src, 99)).toEqual({});
    expect(await resolveImageSizes(src, draft.authorId)).toEqual({
      [src]: { width: 1200, height: 800 },
    });
  });
});
