import { displayName } from "@/utils/profile/display-name";
import type { UserProfile } from "@/store/auth";
import type { BlogPost } from "@/utils/blog/posts";
import {
  normalizeHouseLevel,
  type HouseLevel,
} from "@/utils/city/residence-tiers";
import {
  HOMES_PER_BLOCK,
  orderedResidences,
  type Residence,
} from "@/utils/city/residences";

// Replace this directory adapter with a paginated API when the backend is ready.
// Demo IDs never share the numeric namespace of real accounts.
const names = [
  "프론트노트",
  "서지우",
  "이서연",
  "박도윤",
  "정하늘",
  "윤지호",
  "최수빈",
  "한유진",
  "김태오",
  "오하린",
  "이도현",
  "박소윤",
  "정시우",
  "송나은",
  "임주원",
  "배지안",
  "권민준",
  "유다인",
  "장서준",
  "문채원",
  "안유준",
  "백지민",
  "신도하",
  "홍예린",
  "서준우",
  "조은서",
  "강민서",
  "남지안",
  "고현우",
  "노수아",
  "차은우",
  "변하윤",
  "김도경",
  "양시윤",
  "우지훈",
  "하소민",
  "구태윤",
  "성아린",
  "민재원",
  "진서우",
  "이하준",
  "정다온",
  "박서진",
  "최여름",
  "한이든",
  "윤서아",
  "김로운",
  "오세연",
];

const nicknames = [
  "프론트노트",
  "커밋요정",
  "코드산책",
  "루프메이커",
  "하늘코딩",
  "캐시노트",
  "픽셀수집가",
  "유니코드",
  "타입가드",
  "리팩토리",
  "도커항해사",
  "소프트로그",
  "시퀀스",
  "나무코더",
  "주니어랩",
  "깃모닝",
  "민트코드",
  "데이터다인",
  "서버노트",
  "채움로그",
  "유틸리티",
  "지니코드",
  "도메인랩",
  "예외수집가",
  "준비된개발자",
  "은빛커밋",
  "미니멀코드",
  "지연로딩",
  "현실코딩",
  "수달개발자",
  "은하코드",
  "하루한커밋",
  "도트메이커",
  "시맨틱로그",
  "지식캐시",
  "소소한코딩",
  "태양코드",
  "아키로그",
  "재귀노트",
  "서버워커",
  "하이코드",
  "다온로그",
  "서진랩",
  "여름코딩",
  "이든빌드",
  "서아노트",
  "로운코드",
  "세모개발자",
];

// The points policy is not defined yet. Levels are explicit mock snapshots,
// independent of post counts; a future profile API can return the same shape.
export const mockAccountProgress: Record<
  number,
  { level: HouseLevel; activityPoints: number | null }
> = {};
const initialProgress = { level: 0 as HouseLevel, activityPoints: null };

export const administratorResidence: Residence = {
  id: "demo-codeiary",
  name: "Codeiary",
  nickname: "Codeiary",
  role: "ADMIN",
  postCount: 2,
  level: 5,
  activityPoints: null,
  activity: 100,

  email: "dnjstjt1297@gmail.com",
  github: "https://github.com/dnjstjt1297",
};

const demoResidences: readonly Residence[] = names.map((name, index) => ({
  id: index === 0 ? "demo-frontend" : `demo-neighbor-${index}`,
  name,
  nickname: nicknames[index]!,
  role: "USER",
  postCount: index === 0 ? 2 : (index * 19 + 9) % 127,
  level: normalizeHouseLevel(index % 6),
  activityPoints: null,
  activity: (index * 31 + 67) % 100,
}));

export function residenceDirectory(
  user: UserProfile | null,
  posts: readonly BlogPost[],
) {
  const residents: Residence[] = [administratorResidence, ...demoResidences];
  // Known local authors also get homes automatically, even without a session.
  for (const post of posts) {
    if (
      post.author &&
      !residents.some((resident) => resident.id === post.author!.id)
    ) {
      residents.push({
        ...post.author,
        ...(typeof post.author.id === "number"
          ? (mockAccountProgress[post.author.id] ?? initialProgress)
          : initialProgress),
        role: "USER",
        postCount: 0,
        activity: 0,
      });
    }
  }
  if (user) {
    const existing = residents.findIndex((resident) => resident.id === user.id);
    const account: Residence = {
      ...user,
      ...(mockAccountProgress[user.id] ?? initialProgress),
      postCount: 0,
      activity: 0,
    };
    if (existing >= 0) residents[existing] = account;
    else residents.push(account);
  }
  return residents.map((resident) => {
    if (typeof resident.id !== "number") return { ...resident };
    const publicPosts = posts.filter(
      (post) =>
        post.author?.id === resident.id &&
        post.status === "PUBLISHED" &&
        post.visibility !== "PRIVATE",
    );
    return {
      ...resident,
      postCount: publicPosts.length,
    };
  });
}

export interface NeighborhoodBlock {
  page: number;
  residents: Residence[];
  total: number;
  hasNext: boolean;
}

export async function fetchNeighborhoodBlock(
  directory: readonly Residence[],
  page: number,
): Promise<NeighborhoodBlock> {
  const residents = orderedResidences(directory);
  const start = Math.max(0, page) * HOMES_PER_BLOCK;
  return {
    page,
    residents: residents.slice(start, start + HOMES_PER_BLOCK),
    total: residents.length,
    hasNext: start + HOMES_PER_BLOCK < residents.length,
  };
}

export function searchResidences(
  directory: readonly Residence[],
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return directory.filter((resident) =>
    displayName(resident).toLocaleLowerCase().includes(normalized),
  );
}
