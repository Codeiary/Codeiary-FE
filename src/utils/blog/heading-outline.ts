export interface ArticleHeading {
  id: string;
  text: string;
  level: number;
}
export interface HeadingNode extends ArticleHeading {
  children: HeadingNode[];
}
export function buildHeadingTree(headings: ArticleHeading[]) {
  const roots: HeadingNode[] = [];
  const ancestors: HeadingNode[] = [];
  for (const heading of headings) {
    const node = { ...heading, children: [] } as HeadingNode;
    while (ancestors.length && ancestors[ancestors.length - 1]!.level >= node.level)
      ancestors.pop();
    (ancestors[ancestors.length - 1]?.children ?? roots).push(node);
    ancestors.push(node);
  }
  return roots;
}
