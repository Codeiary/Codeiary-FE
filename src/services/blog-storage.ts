import { openDB, type DBSchema } from "idb";
import type { BlogAuthor, BlogPost, PostVisibility } from "@/utils/blog/posts";
import type {
  ImageLayouts,
  ImageSize,
  ImageSizes,
} from "@/utils/blog/image-layout";

export interface BlogDraft {
  id: string;
  authorId: number;
  author: BlogAuthor;
  title: string;
  category: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  postId?: number;
  imageLayouts?: ImageLayouts;
  coverImage?: string;
  visibility?: PostVisibility;
}
interface BlogImage {
  id: string;
  authorId: number;
  draftId: string;
  dataUrl: string;
}
interface BlogDatabase extends DBSchema {
  drafts: { key: string; value: BlogDraft; indexes: { authorId: number } };
  images: { key: string; value: BlogImage; indexes: { draftId: string } };
  imageSizes: {
    key: string;
    value: ImageSize & { id: string; authorId: number | string };
  };
}

// Only unsent drafts and editor images live in IndexedDB. Published posts use the API.
function database() {
  return openDB<BlogDatabase>("codeiary.blog.mock.v1", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("drafts", { keyPath: "id" }).createIndex(
          "authorId",
          "authorId",
        );
        db.createObjectStore("images", { keyPath: "id" }).createIndex(
          "draftId",
          "draftId",
        );
      }
      if (oldVersion < 2) db.createObjectStore("imageSizes", { keyPath: "id" });
    },
  });
}
export function createDraft(author: BlogAuthor & { id: number }): BlogDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    authorId: author.id,
    author: { id: author.id, name: author.name, nickname: author.nickname },
    title: "",
    category: "",
    content: "",
    tags: [],
    imageLayouts: {},
    visibility: "PUBLIC",
    createdAt: now,
    updatedAt: now,
  };
}
export async function listDrafts(authorId: number) {
  const db = await database();
  try {
    return (await db.getAllFromIndex("drafts", "authorId", authorId)).sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    );
  } finally {
    db.close();
  }
}
export async function readDraft(id: string, authorId: number) {
  const db = await database();
  try {
    const draft = await db.get("drafts", id);
    return draft?.authorId === authorId ? draft : undefined;
  } finally {
    db.close();
  }
}
export async function saveDraft(draft: BlogDraft) {
  const db = await database();
  try {
    const tx = db.transaction("drafts", "readwrite");
    const previous = await tx.store.get(draft.id);
    if (previous && previous.authorId !== draft.authorId)
      throw new Error("초안에 접근할 수 없어요.");
    await tx.store.put(draft);
    await tx.done;
  } finally {
    db.close();
  }
}
export async function deleteDraft(id: string, authorId: number) {
  const db = await database();
  try {
    const draft = await db.get("drafts", id);
    if (draft?.authorId !== authorId) return;
    await db.delete("drafts", id);
  } finally {
    db.close();
  }
}
export async function editPost(post: BlogPost, authorId: number) {
  if (post.author?.id !== authorId || post.content === undefined)
    throw new Error("수정할 수 없는 글이에요.");
  const existing = (await listDrafts(authorId)).find(
    (draft) => draft.postId === post.id,
  );
  if (existing) return existing;
  const draft = {
    ...createDraft({ ...post.author, id: authorId }),
    postId: post.id,
    title: post.title,
    category: post.category,
    content: post.content,
    tags: [...post.tags],
    coverImage: post.coverImage,
    imageLayouts: Object.fromEntries(
      Object.entries(post.imageLayouts ?? {}).map(([key, layout]) => [
        key,
        { ...layout },
      ]),
    ),
    visibility: post.visibility ?? "PUBLIC",
  };
  await saveDraft(draft);
  return draft;
}
export async function addImage(file: File, draft: BlogDraft) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("PNG, JPG, WebP, GIF 이미지를 선택해 주세요.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("이미지는 한 장당 5MB까지 추가할 수 있어요.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
    reader.readAsDataURL(file);
  });
  const image: BlogImage = {
    id: crypto.randomUUID(),
    authorId: draft.authorId,
    draftId: draft.id,
    dataUrl,
  };
  let size: ImageSize | undefined;
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
    } catch {
      // Older browsers and unsupported decoders can record dimensions on load.
    }
  }
  const db = await database();
  try {
    const tx = db.transaction(["images", "imageSizes"], "readwrite");
    await tx.objectStore("images").put(image);
    if (size)
      await tx
        .objectStore("imageSizes")
        .put({ ...size, id: image.id, authorId: image.authorId });
    await tx.done;
  } finally {
    db.close();
  }
  return `attachment:${image.id}`;
}
export async function resolveImageSizes(
  content: string,
  authorId: number | string,
): Promise<ImageSizes> {
  const sources = [
    ...new Set(content.match(/attachment:[a-f0-9-]{36}/g) ?? []),
  ];
  if (!sources.length) return {};
  const db = await database();
  try {
    const entries = await Promise.all(
      sources.map(async (src) => {
        const size = await db.get(
          "imageSizes",
          src.slice("attachment:".length),
        );
        return size?.authorId === authorId
          ? ([src, { width: size.width, height: size.height }] as const)
          : undefined;
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== undefined));
  } finally {
    db.close();
  }
}
export async function saveImageSize(
  src: string,
  authorId: number | string,
  size: ImageSize,
) {
  if (!src.startsWith("attachment:") || size.width <= 0 || size.height <= 0)
    return;
  const db = await database();
  try {
    const id = src.slice("attachment:".length);
    const image = await db.get("images", id);
    if (image?.authorId === authorId)
      await db.put("imageSizes", { id, authorId, ...size });
  } finally {
    db.close();
  }
}
export async function resolveImages(
  content: string,
  authorId: number | string,
) {
  const ids = [...new Set(content.match(/attachment:[a-f0-9-]{36}/g) ?? [])];
  if (!ids.length) return {};
  const db = await database();
  try {
    const entries = await Promise.all(
      ids.map(async (src) => {
        const image = await db.get("images", src.slice("attachment:".length));
        return [
          src,
          image?.authorId === authorId ? image.dataUrl : "",
        ] as const;
      }),
    );
    return Object.fromEntries(entries);
  } finally {
    db.close();
  }
}
